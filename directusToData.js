#!/usr/bin/env node
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require("fs");
const { writeFile } = require("fs/promises")
const { dirname } = require("path");
const { env } = require("process");

const KEYS_TO_FILTER = ["collections", "fields", "relations"];
const NO_WRITE = "NO_WRITE";
let requestStagger = 0;

function _handleError(err) { if (err) { console.error(err); };}

function _returnFirstBooleanOrNumber(...args) {
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === null || arg === undefined) {
            continue;
        }

        switch(arg.constructor) {
            case Boolean:
                return arg;
            
            case Number:
                return arg;
            
            case String:
                if (arg === "true") {
                    return true;
                } else if (arg === "false") {
                    return false;
                }
                try {
                    const parsed = parseInt(arg);
                    return parsed;
                } catch {}
                break;
            
        }
    };
}

function findImagesInDirectusData(object, foundImages=[]) {
    const keys = Object.keys(object);
    // If image data
    if (keys.includes("id") && keys.includes("filename_download")) {
        foundImages.push({id: object.id, filename: object.filename_download});
    }
    for (const [key, value] of Object.entries(object)) {
        if (value && value.constructor === Object) {
            foundImages = findImagesInDirectusData(value, foundImages);
        }
    }
    return foundImages;
}


async function directusRequest(directus, directusOptions, taskLabel, expectValue=false, firstAttempt=true) {
    return new Promise(async (resolve, reject) => {
        setTimeout(async () => {
            try {
                const value = await directus.request(directusOptions).catch(async err => {
                    console.error(`Error whilst trying to ${taskLabel}`);
                    console.error(err);
                    if (firstAttempt) {
                        console.error("Trying again...")
                        resolve(await directusRequest(directus, directusOptions, taskLabel, expectValue, false));
                    } else {
                        reject(err);
                    }
                });
                if (expectValue && !value) {
                    console.error(`No data found in ${taskLabel}, but expectValue is set to true.`)
                    if (firstAttempt) {
                        console.error("Trying again...")
                        resolve(directusRequest(directus, directusOptions, taskLabel, expectValue, false));
                    } else {
                        console.error("Already tried again")
                        throw new Error("tryAgain set to true");
                    }
                }
                if (!firstAttempt) {
                    console.error("Successful " + taskLabel)
                }
                resolve(value);
            } catch (e) {
                console.error(`Error whilst trying to ${taskLabel}`);
                if (firstAttempt) {
                    console.log("Trying again...")
                    return directusRequest(directus, directusOptions, taskLabel, expectValue, false)
                } else {
                    reject(e);
                }
            }
        }, 1000 * requestStagger);
        requestStagger++;
    })

}

/**
 * @description A minimal utility to save a specific Collection from Directus into a local JSON file!
 * 
 * Every parameter listed below can be set in any of the following ways, listed by priority. 1 has the highest priority, with 3 being the latest fallback
 * 
 * @example
 * // 1. Using JavaScript parameters
 * // index.js
 * directusToData({
 *       cmsUrl: "www.example.com",
 * });
 * 
 * // 2. Using a config file (if configFilename is passed)
 * // index.js
 * directusToData({ configFilename: ".directus.json" });
 * // .directus.json
 * {
 *   "cmsUrl": "https://cms.example.com",
 *   "collectionName": "CollectionOne",
 *   "staticToken": "RGL_xKVn7wDEG3-qw3OmccNqR-U9TsUQ"
 * }
 * 
 * // 3. Environment variables
 * env.CMS_URL
 * env.STATIC_TOKEN
 * env.COLLECTION_NAME
 * env.OUTPUT_FILENAME
 * env.CONFIG_FILENAME
 * env.ENCODING
 * 
 * @param cmsUrl url of your Directus instance. Example value: https://cms.example.com
 * @param staticToken static token for user login
 * @param collectionName name(s) of the collection(s) you want to save locally.
 *                       can be passed as string, array or a JSON array string
 * @param collectionOutput where to save the JSON file.
 *                         you can use the {{collectionName}} template string value,
 *                         which will be replaced with the passed collection name.
 *                         optionally, set it to `NO_WRITE` to disable writing to disk
 * @default {{collectionName}}.json
 * @param assetsOutput where to save the asset files.
 *                     you can use the {{filename}} template string value,
 *                     which will be replaced with the passed asset download filename & extension
 *                     optionally, set it to `NO_WRITE` to disable writing to disk
 * @default {{filename}}
 * @param configFilename path towards directus-to-data's json config
 * @default .directus.json
 * @param encoding which encoding to use when reading/writing. Passed directly to Node.js' fs functions
 * @default utf-8
 * @param prettify value to pass to JSON.stringify 'space' parameter to prettify JSON output. Disabled if set to 0 or false. Set to 4 by default if a truthy non-number value or -1 is passed. If a different number is passed, that will be used instead
 * @default 4
 * @param backupSchema path towards file you want to store the collections' schema to. This command ignores collections whose names were not passed
 * @default null
 * @param restoreSchema path towards schema you want to apply to the CMS. This overrides default behaviour. This command ignores collections whose names were not passed
 * @default null
 * @param applySchema for use with --restore-schema/-r. Apply the schema differences to the CMS instead of only displaying the differences
 * @default false
 * @param forceSchema for use with --restore-schema/-r. Applies --force to the SchemaDiff, ignoring schema and deployment Directus version differences
 * @default false
 * @param callback optionally, pass a callback function. It will be invoked with callback(data)
 * @param directusSdk optionally, pass your own instance of @directus/sdk
 */
module.exports = async function({
    cmsUrl="", 
    staticToken="", 
    collectionName="", 
    collectionOutput="",
    assetsOutput="",
    configFilename="",
    encoding="",
    prettify=-1,
    backupSchema="",
    restoreSchema="",
    applySchema=false,
    forceSchema=false,
    callback=function(data){},
    directusSdk=require("@directus/sdk")
}) {
    const { createDirectus, rest, readItems, schemaSnapshot, schemaDiff, schemaApply, readAssetRaw, readAssetArrayBuffer, staticToken: staticTokenAuth } = directusSdk;
    
    // This is done to show parameter as number, whilst having a default falsey value
    if (prettify === -1) {
        prettify = null;
    }

    let config = {}
    configFilename = configFilename || env.CONFIG_FILENAME || ".directus.json";

    if (existsSync(configFilename)) {
        config = JSON.parse(readFileSync(configFilename, {encoding: encoding}));
    }
    cmsUrl = cmsUrl || config["cmsUrl"] || env.CMS_URL;
    staticToken = staticToken || config["staticToken"] || env.STATIC_TOKEN;
    collectionName = collectionName || config["collectionName"] || env.COLLECTION_NAME;
    collectionOutput = collectionOutput || config["collectionOutput"]  || env.OUTPUT_FILENAME || "{{collectionName}}.json";
    assetsOutput = assetsOutput || config["assetsOutput"] || env.ASSETS_OUTPUT || "{{filename}}";
    encoding = encoding || config["encoding"] || env.ENCODING || "utf-8";
    prettify = _returnFirstBooleanOrNumber(prettify, config["prettify"], env.PRETTIFY, true);
    backupSchema = backupSchema || config["backupSchema"] || env.BACKUP_SCHEMA || null;
    restoreSchema = restoreSchema || config["restoreSchema"] || env.RESTORE_SCHEMA || null;
    applySchema = applySchema || config["applySchema"] || env.APPLY_SCHEMA || false;
    forceSchema = forceSchema || config["forceSchema"] || env.FORCE_SCHEMA || false;

    if (!collectionName) {
        console.error("ERROR: directus-to-data requires at least one collection name to be defined");
        return;
    }

    let collectionNameArray = [];
    if (collectionName.constructor === Array) {
        collectionNameArray = collectionName;
    } else {
        try {
            const jsonParsedCollectionName = JSON.parse(jsonParsedCollectionName)
            if (jsonParsedCollectionName.constructor === Array) {
                collectionNameArray = jsonParsedCollectionName;
            }
        } catch (e) {}
    } 
    // If it couldn't be parsed as JSON and wasn't an array, assume string
    collectionNameArray = collectionNameArray.length > 0 ? collectionNameArray : [collectionName];    

    
    if (prettify) {
        if (prettify.constructor === Boolean) {
            prettify = prettify ? 4 : 0;
        }
    } else {
        prettify = 0;
    }
    
    
    let directus;
    try {
        directus = createDirectus(cmsUrl).with(staticTokenAuth(staticToken)).with(rest());
    } catch (e) {
        console.error("Error whilst trying to create Directus SDK client")
        throw e;
    }

    if (restoreSchema) {
        const schemaSnapshot = JSON.parse(readFileSync(restoreSchema, {encoding: encoding}))
        const schemaDiffData = await directusRequest(directus, schemaDiff(schemaSnapshot, forceSchema), "get schema diff data");
        
        // Only keep changes for selected collections
        KEYS_TO_FILTER.forEach(keyToFilter => {
            schemaDiffData.diff[keyToFilter] = schemaDiffData.diff[keyToFilter].filter((entry) => collectionNameArray.includes(entry.collection))
        })

        KEYS_TO_FILTER.forEach((keyToFilter) => {
            schemaDiffData.diff[keyToFilter].forEach((entry) => {
                console.log(`--- ${entry.collection} ---`);
                entry.diff.forEach(difference => {
                    let kind = "";
                    switch (difference.kind) {
                        case "N":
                            kind = "NEW";
                            break;
                        case "E":
                            kind = "EDIT"
                            break;
                        case "D":
                            kind = "DELETE";
                            break;
                        default:
                            kind = `Unknown (${difference.kind})`
                            break;
                    }
                    console.log(kind);
                    Object.keys(difference).forEach((key) => {
                        let keyTitle;
                        switch(key) {
                            case "kind":
                                // kind has already been displayed above
                                return;
                            case "path":
                                keyTitle = "path";
                                break;
                            case "lhs":
                                keyTitle = "Old value (lhs)";
                                break;
                            case "rhs":
                                keyTitle = "New value (rhs)";
                                break;
                            default:
                                keyTitle = key;
                                break;
                        }
                        console.log(`${keyTitle}: ${JSON.stringify(difference[key])}`)
                    })
                })
                
            })
        })
        if (applySchema) {
            console.log("Applying schema...")
            console.log(await directusRequest(directus, schemaApply(schemaDiffData), "applying schema"))
        }
        return;
    }

    if (backupSchema) {
        const schema = await directusRequest(directus, schemaSnapshot(), "getting schema snapshot")
        KEYS_TO_FILTER.forEach(keyToFilter => {
            schema[keyToFilter] = schema[keyToFilter].filter((entry) => collectionNameArray.includes(entry.collection))
        })
        
        writeFileSync(backupSchema, JSON.stringify(schema, null, prettify), {encoding: "utf-8"})
    }
    
    collectionNameArray.forEach(async (collectionName) => {
        const options = {};
        if (collectionName.includes(":")) {
            let fields;
            [collectionName, fields] = collectionName.split(":");
            options.fields = fields;
        }

        const data = await directusRequest(directus, readItems(collectionName, options), `reading items from ${collectionName}`)

        if (collectionOutput != NO_WRITE) {
            const finalCollectionOutput = collectionOutput.replace("{{collectionName}}", collectionName);
            mkdirSync(dirname(finalCollectionOutput), {recursive: true});
            writeFile(finalCollectionOutput, JSON.stringify(data, null, prettify), { encoding: encoding }).catch(_handleError);
        }

        if (assetsOutput != NO_WRITE) {
            const images = findImagesInDirectusData(data)
            images.forEach(async ({id, filename}) => {
                filename = assetsOutput.replace("{{filename}}", filename)
                // Thanks to https://stackoverflow.com/a/78955184
                const stream = await directusRequest(directus, readAssetArrayBuffer(id), `Requesting asset ${filename} (id: ${id})`, true)
                try {
                    writeFile(filename, Buffer.from(stream), {encoding: "utf-8"});
                } catch (e) {
                    console.error(`Error writing ${filename}`)
                    throw e;
                }
            });
        }

        callback(data);
    });
}

if (require.main == module) {
    const { program } = require("commander");
    program
        .name("directus-to-data")
        .description("A minimal utility to save a specific Collection from Directus into a local JSON file!")
        .version("0.7.2")
        .option("-u, --cms-url <url>", "url of your Directus instance. Example value: https://cms.example.com")
        .option("-t, --static-token <token>", "static token for user login")
        .option("-c, --collection-name, --collection <name...>", "name of the collection you want to save locally")
        .option("-o, --collection-output, --output [filename]",
                "where to save the JSON file. you can use the {{collectionName}} template string value, which will be replaced with the passed collection name (default: '{{collectionName}}.json'), optionally, set it to 'NO_WRITE' to disable writing to disk")
        .option("-a, --assets-output, --assets <filename>", 
                "where to save the asset files. you can use the {{filename}} template string value, which will be replaced with the passed asset download filename & extension (default: '{{filename}}'), optionally, set it to 'NO_WRITE' to disable writing to disk")
        .option("-e, --encoding <encoding>", "which encoding to use when reading/writing. Passed directly to Node.js' fs functions (default: 'utf-8')")
        .option("-p, --prettify <space>", "value to pass to JSON.stringify 'space' parameter to prettify JSON output. Disabled if set to 0 or false. Set to 4 by default if a truthy non-number value or -1 is passed. If a different number is passed, that will be used instead")
        .option("-i, --config-filename, --config <filename>", "path towards directus-to-data's json config")
        .option("-b, --backup-schema <filename>", "path towards file you want to store the collections' schema to. This command ignores collections whose names were not passed")
        .option("-r, --restore-schema <filename>", "path towards schema you want to apply to the CMS. This overrides default behaviour. This command ignores collections whose names were not passed")
        .option("--apply-schema", "for use with --restore-schema/-r. Apply the schema differences to the CMS instead of only displaying the differences")
        .option("--force-schema", "for use with --restore-schema/-r. Applies --force to the SchemaDiff, ignoring schema and deployment Directus version differences")
        .action((options) => {
            module.exports(options);
        });

    program.parse();
}
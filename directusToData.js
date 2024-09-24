#!/usr/bin/env node
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require("fs");
const { writeFile } = require("fs/promises")
const { dirname } = require("path");
const { env } = require("process");

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
    if (keys.includes("id") && keys.includes("filename_download")) {
        // if image data
        foundImages.push({id: object.id, filename: object.filename_download})
    }
    for (const [key, value] of Object.entries(object)) {
        if (value && value.constructor === Object) {
            foundImages = findImagesInDirectusData(value, foundImages);
        }
    }
    return foundImages;
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
 *   "cmsUrl": "https://cms.neonpastel.net",
 *   "collectionName": "NeonpastelCat",
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
 *                       you can use the {{collectionName}} template string value,
 *                       which will be replaced with the passed collection name.
 *                       optionally, set it to an empty string ("") to disable writing to disk
 * @default {{collectionName}}.json
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
    callback=function(data){},
    directusSdk=require("@directus/sdk")
}) {
    const { createDirectus, rest, readItems, schemaSnapshot, schemaDiff, schemaApply, readAssetRaw, staticToken: staticTokenAuth } = directusSdk;
    
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
    
    const directus = createDirectus(cmsUrl).with(staticTokenAuth(staticToken)).with(rest());

    if (restoreSchema) {
        const schemaSnapshot = JSON.parse(readFileSync(restoreSchema, {encoding: encoding}))
        const schemaDiffData = await directus.request(schemaDiff(schemaSnapshot));

        const keysToFilter = ["collections", "fields", "relations"]
        
        // Only keep changes for selected collections
        keysToFilter.forEach(keyToFilter => {
            schemaDiffData.diff[keyToFilter] = schemaDiffData.diff[keyToFilter].filter((entry) => collectionNameArray.includes(entry.collection))
        })

        keysToFilter.forEach((keyToFilter) => {
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
            console.log(await directus.request(schemaApply(schemaDiffData)))
        }
        return;
    }

    if (backupSchema) {
        directus.request(schemaSnapshot()).then((schema) => {
            ["collections", "fields", "relations"].forEach(keyToFilter => {
                schema[keyToFilter] = schema[keyToFilter].filter((entry) => collectionNameArray.includes(entry.collection))
            })
            
            writeFileSync(backupSchema, JSON.stringify(schema, null, prettify), {encoding: "utf-8"})
        }).catch(_handleError)

    }
    
    collectionNameArray.forEach((collectionName) => {
        const options = {};
        if (collectionName.includes(":")) {
            let fields;
            [collectionName, fields] = collectionName.split(":");
            options.fields = fields;
        }

        const finalCollectionOutput = collectionOutput.replace("{{collectionName}}", collectionName);

        directus.request(readItems(collectionName, options)).then((data) => {
            
            mkdirSync(dirname(finalCollectionOutput), {recursive: true});
            if (finalCollectionOutput != "") {
                writeFileSync(finalCollectionOutput, JSON.stringify(data, null, prettify), { encoding: encoding }, _handleError);
            }

            const images = findImagesInDirectusData(data)
            images.forEach(async ({id, filename}) => {
                filename = assetsOutput.replace("{{filename}}", filename)
                // Thanks to https://stackoverflow.com/a/78955184
                const stream = await directus.request(readAssetRaw(id))
                await writeFile(filename, stream, {encoding: "utf-8"});
            });

            callback(data);
        }).catch((err) => {console.error(err)});
    });
}

if (require.main == module) {
    const { program } = require("commander");
    program
        .name("directus-to-data")
        .description("A minimal utility to save a specific Collection from Directus into a local JSON file!")
        .version("0.6.0")
        .option("-u, --cms-url <url>", "url of your Directus instance. Example value: https://cms.example.com")
        .option("-t, --static-token <token>", "static token for user login")
        .option("-c, --collection-name, -cn, --collection <name...>", "name of the collection you want to save locally")
        .option("-co, --collection-output <filename>, --output <filename>",
                "where to save the JSON file. you can use the {{collectionName}} template string value, which will be replaced with the passed collection name (default: '{{collectionName}}.json')")
        .option("-a, --asset-ids, --assets, --asset <id...>", 
                "where to save the asset files. you can use the {{filename}} template string value, which will be replaced with the passed asset download filename (default: '{{filename}}')")
        .option("-ao, --assets-output <filename>", "")
        .option("-e, --encoding <encoding>", "which encoding to use when reading/writing. Passed directly to Node.js' fs functions (default: 'utf-8')")
        .option("-p, --prettify <space>", "value to pass to JSON.stringify 'space' parameter to prettify JSON output. Disabled if set to 0 or false. Set to 4 by default if a truthy non-number value or -1 is passed. If a different number is passed, that will be used instead")
        .option("-i, --config-filename, --config <filename>", "path towards directus-to-data's json config")
        .option("-b, --backup-schema <filename>", "path towards file you want to store the collections' schema to. This command ignores collections whose names were not passed")
        .option("-r, --restore-schema <filename>", "path towards schema you want to apply to the CMS. This overrides default behaviour. This command ignores collections whose names were not passed")
        .option("--apply-schema", "for use with --restore-schema/-r. Apply the schema differences to the CMS instead of only displaying the differences")
        .action((options) => {
            module.exports(options);
        });

    program.parse();
}
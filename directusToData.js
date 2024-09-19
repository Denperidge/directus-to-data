#!/usr/bin/env node
const { writeFileSync, readFileSync, existsSync, mkdirSync } = require("fs");
const { dirname } = require("path");
const { env } = require("process");

function _handleError(err) { if (err) { console.error(err); };}

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
 * @param outputFilename where to save the JSON file.
 *                       you can use the {{collectionName}} template string value,
 *                       which will be replaced with the passed collection name.
 *                       optionally, set it to an empty string ("") to disable writing to disk
 * @default {{collectionName}}.json
 * @param configFilename path towards directus-to-data's json config
 * @default .directus.json
 * @param encoding which encoding to use when reading/writing. Passed directly to Node.js' fs functions
 * @default utf-8
 * @param callback optionally, pass a callback function. It will be invoked with callback(data)
 * @param directusSdk optionally, pass your own instance of @directus/sdk
 */
module.exports = async function({
    cmsUrl="", 
    staticToken="", 
    collectionName="", 
    outputFilename="",
    configFilename="",
    encoding="",
    backupSchema="",
    restoreSchema="",
    callback=function(data){},
    directusSdk=require("@directus/sdk")
}) {
    const { createDirectus, rest, readItems, schemaSnapshot, schemaDiff, schemaApply, staticToken: staticTokenAuth } = directusSdk;
    
    let config = {}
    configFilename = configFilename || env.CONFIG_FILENAME || ".directus.json";

    console.log(configFilename)

    if (existsSync(configFilename)) {
        config = JSON.parse(readFileSync(configFilename, {encoding: encoding}));
        console.log(config)
    }
    cmsUrl = cmsUrl || config["cmsUrl"] || env.CMS_URL;
    staticToken = staticToken || config["staticToken"] || env.STATIC_TOKEN;
    collectionName = collectionName || config["collectionName"] || env.COLLECTION_NAME;
    outputFilename = outputFilename || config["outputFilename"]  || env.OUTPUT_FILENAME || "{{collectionName}}.json";
    encoding = encoding || config["encoding"] || env.ENCODING || "utf-8";
    backupSchema = backupSchema || config["backupSchema"] || env.BACKUP_SCHEMA || false;
    restoreSchema = restoreSchema || config["restoreSchema"] || env.RESTORE_SCHEMA || null;

    let collectionNameArray = [];


    if (collectionName && !restoreSchema) {
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
    }
    
    const directus = createDirectus(cmsUrl).with(staticTokenAuth(staticToken)).with(rest());

    if (restoreSchema) {
        const schemaSnapshot = JSON.parse(readFileSync(restoreSchema, {encoding: encoding}))
        const schemaDiffData = await directus.request(schemaDiff(schemaSnapshot));

        const keysToFilter = ["collections", "fields", "relations"]
        
        keysToFilter.forEach(keyToFilter => {
            //schemaDiffData.diff[keyToFilter] = schemaDiffData.diff[keyToFilter].filter((entry) => collectionNameArray.includes(entry.collection))
        })
        //console.dir(schemaDiffData, {depth: null});

        keysToFilter.forEach((keyToFilter) => {
            console.log("@@@")
            schemaDiffData.diff[keyToFilter].forEach((entry) => {
                entry.diff.forEach(difference => {
                    let kind = "";
                    switch (difference.kind) {
                        case "N":
                            kind = "New";
                            break;
                        case "D":
                            kind = "Delete";
                            break;
                        default:
                            kind = `Unknown (${difference.kind})`
                            break;
                    }
                    console.log(`${kind}: ${entry.collection}`)
                })
                
            })
        })
        //directus.request(schemaApply(data)) 
        return;
    }

    if (backupSchema) {
        directus.request(schemaSnapshot()).then((schema) => {
            ["collections", "fields", "relations"].forEach(keyToFilter => {
                schema[keyToFilter] = schema[keyToFilter].filter((entry) => collectionNameArray.includes(entry.collection))
            })
            
            writeFileSync("test.json", JSON.stringify(schema), {encoding: "utf-8"})
        }).catch(_handleError)

    }
    
    collectionNameArray.forEach((collectionName) => {
        const finalOutputFilename = outputFilename.replace("{{collectionName}}", collectionName);

        

        directus.request(readItems(collectionName)).then((data) => {    
            mkdirSync(dirname(finalOutputFilename), {recursive: true});
            if (finalOutputFilename != "") {
                writeFileSync(finalOutputFilename, JSON.stringify(data), { encoding: encoding }, _handleError);
            }
            callback(data);
        }).catch((err) => {console.error(err)});
    });
}

function restoreSchema(filename, apply=false) {
    
}

if (require.main == module) {
    const { program } = require("commander");
    program
        .name("directus-to-data")
        .description("A minimal utility to save a specific Collection from Directus into a local JSON file!")
        .version("0.2.0")
        .option("-u, --cms-url <url>", "url of your Directus instance. Example value: https://cms.example.com")
        .option("-t, --static-token <token>", "static token for user login")
        .option("-c, --collection-name, --collection <name>", "name of the collection you want to save locally")
        .option("-o, --output-filename <filename>, --output <filename>",
                "where to save the JSON file. you can use the {{collectionName}} template string value, which will be replaced with the passed collection name (default: '{{collectionName}}.json')")
        .option("-e, --encoding <encoding>", "which encoding to use when reading/writing. Passed directly to Node.js' fs functions (default: 'utf-8')")
        .option("-i, --config-filename, --config <filename>", "path towards directus-to-data's json config")
        .option("-r, --restore-schema <filename>", "path towards schema you want to apply the CMS url. This overrides default behaviour")
        .action((options) => {
            module.exports(options);
        });

    program.parse();
}
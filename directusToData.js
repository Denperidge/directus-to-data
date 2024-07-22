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
 * @param collectionName name of the collection you want to save locally
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
    callback=function(data){},
    directusSdk=require("@directus/sdk")
}) {
    const { createDirectus, rest, readItems, staticToken: staticTokenAuth } = directusSdk;
    
    let config = {}
    configFilename = configFilename || env.CONFIG_FILENAME || ".directus.json";

    if (existsSync(configFilename)) {
        config = JSON.parse(readFileSync(configFilename, {encoding: encoding}));
    }
    cmsUrl = cmsUrl || config["cmsUrl"] || env.CMS_URL;
    staticToken = staticToken || config["staticToken"] || env.STATIC_TOKEN;
    collectionName = collectionName || config["collectionName"] || env.COLLECTION_NAME;
    outputFilename = outputFilename || config["outputFilename"]  || env.OUTPUT_FILENAME || "{{collectionName}}.json";
    encoding = encoding || config["encoding"] || env.ENCODING || "utf-8";

    outputFilename = outputFilename.replace("{{collectionName}}", collectionName);

    const directus = createDirectus(cmsUrl).with(staticTokenAuth(staticToken)).with(rest());

    directus.request(readItems(collectionName)).then((data) => {
        mkdirSync(dirname(outputFilename), {recursive: true});
        if (outputFilename != "") {
            writeFileSync(outputFilename, JSON.stringify(data), { encoding: encoding }, _handleError);
        }
        callback(data);
    }).catch((err) => {console.error(err)});
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
        .action((options) => {
            module.exports(options);
        });

    program.parse();
}
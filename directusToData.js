const { writeFile, readFileSync, existsSync } = require("fs");
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
 * 
 * @param cmsUrl url of your Directus instance
 * @param staticTokenValue static token for user login
 * @param collectionName name of the collection you want to save locally
 * @param outputFilename where to save the JSON file.
 *                       you can use the {{collectionName}} template string value,
 *                       which will be replaced with the passed collection name
 * @default src/_data/{{collectionName}}.json
 * @param configFilename where the directus-to-date.json
 * @default .directus.json
 * @param encoding which encoding to use when reading/writing
 * @default utf-8
 * @param directusSdk optionally, pass your own instance of @directus/sdk
 */
module.exports = async function({
    cmsUrl="", 
    staticTokenValue="", 
    collectionName="", 
    outputFilename="src/_data/{{collectionName}}.json", 
    configFilename=".directus.json",
    encoding="utf-8",
    directusSdk=require("@directus/sdk")
}) {
    const { createDirectus, rest, readItems, staticToken } = directusSdk;
    let config = {}
    if (existsSync(configFilename)) {
        config = JSON.parse(readFileSync(configFilename, {encoding: encoding}));
    }
    cmsUrl = cmsUrl || config["cmsUrl"] || env.CMS_URL;
    staticTokenValue = staticTokenValue || config["staticTokenValue"] || config["staticToken"] || env.STATIC_TOKEN;
    collectionName = collectionName || config["collectionName"] || env.COLLECTION_NAME;
    outputFilename = outputFilename || config["outputFilename"]  || env.OUTPUT_FILENAME;

    outputFilename = outputFilename.replace("{{collectionName}}", collectionName);

    const directus = createDirectus(cmsUrl).with(staticToken(staticTokenValue)).with(rest());

    directus.request(readItems(collectionName)).then((data) => {
        writeFile(outputFilename, JSON.stringify(data), { encoding: encoding }, _handleError);
    }).catch((err) => {console.error(err)});
}

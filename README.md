# Directus to Data
A minimal utility to save a specific Collection from Directus into a local JSON file!

## How-to
### Usage (cli)
```bash
npx directus-to-data -u https://cms.example.com -t DAE_DOJ?1-edOJQHDS -c MyCollection  # Basic usage
npx directus-to-data -i ../.directus.json  # config file usage
npx directus-to-data --help  # View all options
```

You can alternatively configure `directus-to-data` using environment variables
or a config file. See [Reference - Options](#options) or [directusToData.js](directusToData.js) for further documentation.

### Usage (code)
> Note: the following example is written for use with 11ty, but it can easily be adapted for any usecase.

```js
// Import the package
const directusToData = require("directus-to-data");

module.exports = function (eleventyConfig) {
    directusToData({
        cmsUrl: "https://cms.example.com",
        outputFilename: "src/_data/{{collectionName}}.json",
        collectionName: "MyCollection",
        staticToken: "DAE_DOJ?1-edOJQHDS"
    });
    /**
     * And done! As soon as this function is run,
     * the data will be downloaded and saved in src/_data/MyCollection.json
     */
}
```

You can alternatively configure `directus-to-data` using environment variables
or a config file. See [Reference - Options](#options) or [directusToData.js](directusToData.js) for further documentation.

## Reference
### Options
| Description | Function/`.directus.json` parameter | CLI option            | env var    | default value | example value           |
| ----------- | ----------------------------------- | --------------------- | ---------- | ------------- | ----------------------- |
| url of your Directus instance | `cmsUrl`                            | `-u, --cms-url <url>` |  `CMS_URL` | Not set       | https://cms.example.com |
| static token for user login | `staticToken`       | `-t, --static-token <token>` | `STATIC_TOKEN` | Not set | DAE_DOJ?1-edOJQHDS |
| name of the collection you want to save locally | `collectionName` | `-c, --collection-name, --collection <name>` | `COLLECTION_NAME` | Not set | MyCollection |
| where to save the JSON file. you can use the `{{collectionName}}` template string value, which will be replaced with the passed collection name | `outputFilename` | `-o, --output-filename, --output <filename>` | `OUTPUT_FILENAME` | {{collectionName}}.json | src/_data/{{collectionName}}.json |
| which encoding to use when reading/writing. Passed directly to Node.js' fs functions | `encoding` | `-e, --encoding <encoding>` | `ENCODING` | utf-8 | ascii |
| path towards directus-to-data's json config | `configFilename`* | `-i, --config-filename, --config <filename>` | `CONFIG_FILENAME` | .directus.json | ../directus-to-data.json |
| directusSdk | `directusSdk`* | N/A | N/A | `require("@directus/sdk")` | `customDirectusSdkInstance` |

*: Does **not** support .directus.json

## Explanation
### Why use `-i` for config-filename
-c was already taken and -i can stand for input. Best justification I have.

### Why not set the defaults in commander?
With how the base function is coded, setting defaults in the regular way in commander overwrites any values set by other means, making the default values always override others.


## License
This project is released into the public domain under the [Unlicense](LICENSE).

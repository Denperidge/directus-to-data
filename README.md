# Directus to Data
A minimal utility to save a specific Collection from Directus into a local JSON file!

## How-to
> Note: the following example is configured for use with 11ty, but it can easily be adapted for any usecase.

```js
// Import the package
const directusToData = require("directus-to-data");

module.exports = function (eleventyConfig) {
    directusToData({
        cmsUrl: "https://cms.example.com",
        outputFilename: "src/_data/{{collectionName}}.json"
        collectionName: "MyCollection",
        staticToken: "DAE_DOJ?1-edOJQHDS&"
    });
    /**
     * And done! As soon as this function is run,
     * the data will be downloaded and saved in src/_data/MyCollection.json
     */

}
```

You can alternatively configure `directus-to-data` using environment variables
or a config file. See [directusToData.js](directusToData.js) for further documentation.

## License
This project is released into the public domain under the [Unlicense](LICENSE).

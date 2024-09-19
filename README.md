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

### Usage (config file)
```js
// .data.mjs
directusToData({
  configFilename: ".directus.json",
  collectionName: ["FirstCollection", "SecondCollection"],
  outputFilename: "src/_data/{{collectionName}}.json",
});

// .directus.json
{
  "cmsUrl": "https://cms.example.com",
  "staticToken": "DAE_DOJ?1-edOJQHDS"
}
```

You can alternatively configure `directus-to-data` using environment variables.
See [Reference - Options](#options) or [directusToData.js](directusToData.js) for further documentation.

### Backup & restore collection schema
> Note: due to Directus limitations, this requires credentials for an admin account of your local CMS instance

By default, Directus supports [exporting & importing a schema](https://docs.directus.io/reference/system/schema). However, this by default exports & imports *all* tables. To better support shared/multi-site instances & supporting the ability to have others be able to quickly import a schema for projects, directus-to-data only backups & restores your schemas based on the *collectionNames* that have been passed (see [#options](#options)), ignoring all other collection changes.

```bash
# Backup the collections' schemas
npx directus-to-data --backup-schema schema.json -c "CollectionOne" -c "CollectionTwo" --cms-url https://cms.example.com --staticToken DAE_DOJ?1-edOJQHDS

# View the changes that would be made from restoring the provided schema to the CMS
npx directus-to-data --restore-schema schema.json -c "CollectionOne" -c "CollectionTwo" --cms-url https://cms.example.com --staticToken DAE_DOJ?1-edOJQHDS
# Note: staticToken should be configured through env variables or the config file. It is shown here for clarity

# If you're sure, apply changes
npx directus-to-data --apply --restore-schema schema.json -c "CollectionOne" -c "CollectionTwo" --cms-url https://cms.example.com --staticToken DAE_DOJ?1-edOJQHDS
```


### CI Integration example
The following file can be used in combination with Directus Flow's webhook/request url integration for an automatically updating website.
See [GitHub API - Create a workflow dispatch event](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)

```yml
# .github/workflows/directus.yml
name: Update data from Directus webhook
on:
  workflow_dispatch:  # Manual run
concurrency:  # If multiple builds are going, keep most recent
  group: directus
  cancel-in-progress: true
jobs:
  update-data:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Install directus-to-data
        run: yarn add directus-to-data
      - name: Fetch data
        run: npx directus-to-data
        env:
          CMS_URL: ${{ secrets.CMS_URL }}
          COLLECTION_NAME: MyCollection
          STATIC_TOKEN: ${{ secrets.STATIC_TOKEN }}
          OUTPUT_FILENAME: src/_data/{{collectionName}}.json
      - uses: EndBug/add-and-commit@v9
        with:
          add: 'src/_data/*'  # git add
          default_author: github_actions  # Commit as github-actions bot
          message: 'CMS update (${{ github.event.repository.updated_at}})'

  # Example with a local GitHub Pages deploy workflow
  # Make sure it has the following configuration so it can be called from a different workflow
  #   on:
  #     workflow_call:
  deploy:
    uses: ./.github/workflows/deploy.yml
    needs: update-data
    permissions:
      contents: read
      pages: write
      id-token: write
    secrets: inherit  # Pass secrets to called workflow
```

## Reference
### Options
| Description | Function/`.directus.json` parameter | CLI option            | env var    | default value | example value           |
| ----------- | ----------------------------------- | --------------------- | ---------- | ------------- | ----------------------- |
| url of your Directus instance | `cmsUrl`                            | `-u, --cms-url <url>` |  `CMS_URL` | Not set       | https://cms.example.com |
| static token for user login | `staticToken`       | `-t, --static-token <token>` | `STATIC_TOKEN` | Not set | DAE_DOJ?1-edOJQHDS |
| name(s) of the collection(s) you want to save locally. can be passed as string, array or a JSON array string | `collectionName` | `-c, --collection-name, --collection <name>` | `COLLECTION_NAME` | Not set | MyCollection or ["CollectionOne", "CollectionTwo"] or '["CollectionOne", "CollectionTwo"]' |
| where to save the JSON file. you can use the `{{collectionName}}` template string value, which will be replaced with the passed collection name. Optionally, set it to an empty string (`""`) to disable writing to disk | `outputFilename` | `-o, --output-filename, --output <filename>` | `OUTPUT_FILENAME` | {{collectionName}}.json | src/_data/{{collectionName}}.json |
| which encoding to use when reading/writing. Passed directly to Node.js' fs functions | `encoding` | `-e, --encoding <encoding>` | `ENCODING` | utf-8 | ascii |
| path towards file you want to store the collections' schema to. This command ignores collections whose names were not passed | `backupSchema` | `-b, --backup-schema <filename>` | `BACKUP_SCHEMA` | `null` | `schema.json` |
| path towards schema you want to apply to the CMS. **This overrides default behaviour.** This command ignores collections whose names were not passed | `restoreSchema` | `-r, --restore-schema <filename>` | `RESTORE_SCHEMA` | `null` | `schema.json` |
| for use with --restore-schema/-r. Apply the schema differences to the CMS instead of only displaying the differences | `applySchema` | `-a, --apply", "--apply-schema` | `APPLY_SCHEMA` | `false` | `true` |
| path towards directus-to-data's json config | `configFilename`* | `-i, --config-filename, --config <filename>` | `CONFIG_FILENAME` | .directus.json | ../directus-to-data.json |
| Optionally, pass a callback function. It will be invoked with callback(data) | `callback`* | N/A | N/A | `function(data){}` | `function(data) { console.log(data); }` |
| Optionally, pass your own instance of @directus/sdk | `directusSdk`* | N/A | N/A | `require("@directus/sdk")` | `customDirectusSdkInstance` |

- \*: Does **not** support .directus.json
- \*\*: Requires an admin account

## Explanation
### Why use `-i` for config-filename
-c was already taken and -i can stand for input. Best justification I have.

### Why not set the defaults in commander?
With how the base function is coded, setting defaults in the regular way in commander overwrites any values set by other means, making the default values always override others.


## License
This project is released into the public domain under the [Unlicense](LICENSE).

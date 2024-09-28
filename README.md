# Directus to Data
A minimal utility to save a specific Collection from Directus into a local JSON file!

## How-to
### Usage
#### Usage: CLI
```bash
npx directus-to-data -u https://cms.example.com -t DAE_DOJ?1-edOJQHDS -c MyCollection  # Basic usage
npx directus-to-data -i ../.directus.json  # config file usage
npx directus-to-data --help  # View all options
```

You can alternatively configure `directus-to-data` using environment variables
or a config file. See [Reference - Options](#options) or [directusToData.js](directusToData.js) for further documentation.

#### Usage: Code
> Note: the following example is written for use with 11ty, but it can easily be adapted for any usecase.

```js
// Import the package
const directusToData = require("directus-to-data");

module.exports = function (eleventyConfig) {
    directusToData({
        cmsUrl: "https://cms.example.com",
        collectionOutput: "src/_data/{{collectionName}}.json",
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

#### Usage: Config file 
```js
// .data.mjs
directusToData({
  configFilename: ".directus.json",
  collectionName: ["FirstCollection", "SecondCollection"],
  collectionOutput: "src/_data/{{collectionName}}.json",
});

// .directus.json
{
  "cmsUrl": "https://cms.example.com",
  "staticToken": "DAE_DOJ?1-edOJQHDS"
}
```

You can alternatively configure `directus-to-data` using environment variables.
See [Reference - Options](#options) or [directusToData.js](directusToData.js) for further documentation.


### Specifying fields & downloading assets/files
- To specify fields for a collection, use the `collectionName:selectorString` syntax.
- If any objects with an `id` & `filename_download` key are found, directus-to-data will download those assets. You can modify the [assetsOutput option](#options) to specify a subdirectory 
```bash
# This will fetch CollectionOne fully, and CollectionTwo all first-descendant values, with the image field also requesting its own id & filename_download properties, as such downloading the files
directus-to-data --assets-output src/assets/{{filename}} -c CollectionOne -c CollectionTwo:*,image.id,image.filename_download --collection-output src/_data/{{collectionName}}.json 
```

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
npx directus-to-data --apply-schema --restore-schema schema.json -c "CollectionOne" -c "CollectionTwo" --cms-url https://cms.example.com --staticToken DAE_DOJ?1-edOJQHDS
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
  # Make sure to check the configuration below to ensure it can be called from a different workflow
  deploy:
    uses: ./.github/workflows/deploy.yml
    needs: update-data
    permissions:
      contents: read
      pages: write
      id-token: write
    secrets: inherit  # Pass secrets to called workflow
```
Please see the comments marked with !IMPORTANT in the following example,
to ensure your deploy CI has the correct settings.
```yml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:  # Runs on pushes targeting the default branch
    branches: ["main"]
  workflow_dispatch: # Allows you to run this workflow manually from the Actions tab
  # !IMPORTANT Allows this workflow to be called from other workflows
  workflow_call:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow one concurrent deployment
concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:  #!IMPORTANT Select latest ref instead of event trigger
          ref: ${{ github.ref }}
      - uses: actions/setup-node@v4
          
      - name: Setup Pages
        uses: actions/configure-pages@v5
        
      - name: Install pre-requirements
        run: yarn install

      - name: Build
        run: yarn build
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          # Upload entire repository
          path: 'dist/'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Directus flow GitHub builds
> Note: this is currently a horridly manual setup, which is not what I like. But alas.
1. Create personal access tokens for your repository. See https://github.com/settings/tokens . If the repo is part of an organisation, it may need to enable the ability to allow personal access tokens
   - Limit it to the relevant repositories
   - Enable `Actions > Read and write`/`Read and Write access to actions`
3. Logged in as an admin, navigate to Settings > Flows (`https://cms.example.com/admin/settings/flows`) and create a new flow. The trigger can be anything, but (unless you modify the scripts), you wanna turn off `Collection Page > Requires Selection`
4. Add a `run script`. Modify the example below and add it to the sript
    ```js
    module.exports = async function(data) {
    	// Fallbacks for automatic vs manual trigger
        const changedCollection = data["$trigger"]["collection"] || data["$trigger"]["body"]["collection"];
        let owner;
        let repo;
        let auth;
        if (changedCollection == "CollectionOne") {
        	owner = "MyAccount";
            repo = "MyRepo";
            auth = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN";
        } else if (changedCollection == "CollectionTwo") {
        	owner = "MyOrganisation";
            repo = "OrgRepo";
            auth = "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN";
        } else {
        	throw Error(changedCollection + " not configured. Data: " + JSON.stringify(data));
        }
    	return {
            "owner": owner,
            "repo": repo,
            "auth": "Bearer " + auth
        };
    }
    ```
5. Add a `Webhook/Request URL` block after
   - Method: `POST`
   - URL: `https://api.github.com/repos/{{$last.owner}}/{{$last.repo}}/actions/workflows/directus.yml/dispatches`
   - Headers:
     - `Accept`: `application/vnd.github+json`
     - `Authorization`: `{{$last.auth}}`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - Request Body: `{"ref":"main"}` 
6. Optionally, add a Log to console with `{{$last}}`



## Reference
### Options
| Description | Function/`.directus.json` parameter | CLI option            | env var    | default value | example value           |
| ----------- | ----------------------------------- | --------------------- | ---------- | ------------- | ----------------------- |
| url of your Directus instance | `cmsUrl`                            | `-u, --cms-url <url>` |  `CMS_URL` | Not set       | https://cms.example.com |
| static token for user login | `staticToken`       | `-t, --static-token <token>` | `STATIC_TOKEN` | Not set | DAE_DOJ?1-edOJQHDS |
| name(s) of the collection(s) you want to save locally. can be passed as string, array or a JSON array string | `collectionName` | `-c, --collection-name, --collection <name>` | `COLLECTION_NAME` | Not set | MyCollection or ["CollectionOne", "CollectionTwo"] or '["CollectionOne", "CollectionTwo"]'
| where to save the JSON file. you can use the `{{collectionName}}` template string value, which will be replaced with the passed collection name. Optionally, set it to `NO_WRITE` to disable writing to disk | `collectionOutput` | `-o, --collection-output, --output <filename>` | `OUTPUT_FILENAME` | {{collectionName}}.json | src/_data/{{collectionName}}.json |
| where to save the asset files. you can use the {{filename}} template string value, which will be replaced with the passed asset download filename & extension. Optionally, set it to "NO_WRITE" to disable writing to disk | `assetsOutput` | `-a, --assets-output, --assets <filename>` | `ASSETS_OUTPUT` | {{filename}} | src/assets/{{filename}} | 
| which encoding to use when reading/writing. Passed directly to Node.js' fs functions | `encoding` | `-e, --encoding <encoding>` | `ENCODING` | utf-8 | ascii |
| value to pass to JSON.stringify 'space' parameter to prettify JSON output. Disabled if set to 0 or false. Set to 4 by default if a truthy non-number value or -1 is passed. If a different number is passed, that will be used instead | `prettify` | `-p, --prettify <space>` | `PRETTIFY` | 4 | 0, false, 6 |
| path towards file you want to store the collections' schema to. This command ignores collections whose names were not passed | `backupSchema`\*\* | `-b, --backup-schema <filename>` | `BACKUP_SCHEMA` | `null` | `schema.json` |
| path towards schema you want to apply to the CMS. **This overrides default behaviour.** This command ignores collections whose names were not passed | `restoreSchema`\*\* | `-r, --restore-schema <filename>` | `RESTORE_SCHEMA` | `null` | `schema.json` |
| for use with --restore-schema/-r. Apply the schema differences to the CMS instead of only displaying the differences | `applySchema`\*\* | `--apply-schema` | `APPLY_SCHEMA` | `false` | `true` |
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

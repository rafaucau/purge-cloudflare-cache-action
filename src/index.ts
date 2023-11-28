// External dependencies
import * as core from '@actions/core';
import Cloudflare from 'cloudflare';
import Sitemapper from 'sitemapper';
import {chunk, uniq} from 'lodash-es';

// Internal dependencies
import checkAuthInput from './checkAuthInput.js';

const zoneId = core.getInput('zone', {required: true});

const apiToken = core.getInput('api_token');

const email = core.getInput('email');
const apiKey = core.getInput('api_key');

checkAuthInput(apiToken, email, apiKey);

//
const client = new Cloudflare({
  token: apiToken.length === 0 ? undefined : apiToken,
  email: email.length === 0 ? undefined : email,
  key: apiKey.length === 0 ? undefined : apiKey
});

//
const files = core.getInput('files');
let filesArray: string[] = [];

if (files.length) {
  filesArray = files.split(' ');
}

function purgeCache(files: string[]) {
  client.zones
    .purgeCache(zoneId, {
      //@ts-ignore missing purge_everything type - https://github.com/cloudflare/node-cloudflare/pull/107
      purge_everything: files.length === 0 ? true : undefined,
      files: files.length === 0 ? undefined : files
    })
    .then(response => {
      console.log('Purged: ', files.join(', '));
    })
    .catch(error => {
      console.error(error);
      core.setFailed(error.message);
    });
}

async function run() {
  //
  const sitemapUrl = core.getInput('sitemap');
  if (sitemapUrl.length) {
    // @ts-ignore
    const sitemap = new Sitemapper({url: sitemapUrl, timeout: 60000});

    await sitemap
      .fetch()
      .then(({sites}) => {
        console.log(`Found ${sites.length} URLs in the sitemap`);
        filesArray = filesArray.concat(sites);
      })
      .catch(error => {
        console.error(error);
      });
  }

  if (filesArray.length) {
    // Remove duplicates
    filesArray = uniq(filesArray);
  }

  if (filesArray.length > 30) {
    // Cloudflare's API allows you to clear only 30 URLs at once
    const chunks = chunk(filesArray, 30);
    chunks.forEach(chunk => {
      purgeCache(chunk);
    });
  } else {
    purgeCache(filesArray);
  }
}

run();

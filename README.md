# class GoLogin - class for working with <a href="https://gologin.com" target="_blank">gologin.com</a> API
# Official Package

## Getting Started

GoLogin supports Linux, MacOS and Windows platforms.

### Installation

`npm i gologin`

for running example.js install puppeteer-core

`npm i puppeteer-core`

### Usage

Where is token? API token is <a href="https://app.gologin.com/#/personalArea/TokenApi" target="_blank">here</a>.
To have an access to the page below you need <a href="https://app.gologin.com/#/createUser" target="_blank">register</a> GoLogin account.

![Token API in Settings](https://user-images.githubusercontent.com/12957968/146891933-c3b60b4d-c850-47a5-8adf-bc8c37372664.gif)

### Example

```js
import puppeteer from 'puppeteer-core';

import GoLogin from '../src/gologin.js';

const { connect } = puppeteer;

(async () => {
  const GL = new GoLogin({
    token: 'yU0token',
    profile_id: 'yU0Pr0f1leiD',
  });

  const { status, wsUrl } = await GL.start().catch((e) => {
    console.trace(e);

    return { status: 'failure' };
  });

  if (status !== 'success') {
    console.log('Invalid status');

    return;
  }

  const browser = await connect({
    browserWSEndpoint: wsUrl.toString(),
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.goto('https://myip.link/mini');
  console.log(await page.content());
  await browser.close();
  await GL.stop();
})();
```

### Running example:

`DEBUG=gologin* node example.js`

###
### Methods
#### constructor

- `options` <[Object]> Options for profile
    - `autoUpdateBrowser` <[boolean]> do not ask whether download new browser version (default false)
    - `token` <[string]> your API <a href="https://gologin.com/#/personalArea/TokenApi" target="_blank">token</a>
    - `profile_id` <[string]> profile ID
    - `executablePath` <[string]> path to executable Orbita file. Orbita will be downloaded automatically if not specified.
    - `remote_debugging_port` <[int]> port for remote debugging
    - `vncPort` <[integer]> port of VNC server if you using it
    - `tmpdir` <[string]> path to temporary directore for saving profiles
    - `extra_params` arrayof <[string]> extra params for browser orbita (ex. extentions etc.)
    - `uploadCookiesToServer` <[boolean]> upload cookies to server after profile stopping (default false)
    - `writeCookesFromServer` <[boolean]> download cookies from server and write to profile cookies file (default true)
    - `skipOrbitaHashChecking` <[boolean]> skip hash checking for Orbita after downloading process (default false)

```js
import GoLogin from '../src/gologin.js';
const GL = new GoLogin({
    token: 'yU0token',
    profile_id: 'yU0Pr0f1leiD',
});
```

#### start()  

- returns: <[object]> { status, wsUrl } 

start browser with profile id, returning WebSocket url for puppeteer

#### stop()  

stop browser with profile id

### DEBUG

For debugging use `DEBUG=* node example.js` command

### Selenium

To use GoLogin with Selenium see  `selenium/example.js`

## Full GoLogin API
**Swagger:** <a href="https://api.gologin.com/docs" target="_blank">link here</a>

**Postman:** <a href="https://documenter.getpostman.com/view/21126834/Uz5GnvaL" target="_blank">link here</a>


## For local profiles

#### startLocal()  

- returns: string 

start browser with profile id, return WebSocket url for puppeteer. Extracted profile folder should be in specified temp directory.

#### stopLocal()  

stop current browser without removing archived profile 

### example-local-profile.js

```js
import puppeteer from 'puppeteer-core';

import GoLogin from '../src/gologin.js';

const { connect } = puppeteer;

(async () => {
  const GL = new GoLogin({
    token: 'yU0token',
    profile_id: 'yU0Pr0f1leiD',
    executablePath: '/usr/bin/orbita-browser/chrome',
    tmpdir: '/my/tmp/dir',
  });

  const wsUrl = await GL.startLocal();
  const browser = await connect({
    browserWSEndpoint: wsUrl.toString(),
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.goto('https://myip.link');
  console.log(await page.content());
  await browser.close();
  await GL.stopLocal({ posting: false });
})();
```

## Python support

<a href="https://github.com/pyppeteer/pyppeteer" target="_blank">pyppeteer</a> (recommend) and <a href="https://www.selenium.dev" target="_blank">Selenium</a> supported (see file gologin.py)

for Selenium may need download <a href="https://chromedriver.chromium.org/downloads" target="_blank">webdriver</a>

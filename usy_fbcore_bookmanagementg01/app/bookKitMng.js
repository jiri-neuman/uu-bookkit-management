const {Config} = require("uu_appg01_core-utils");
const DefaultConfig = require("../config/default");
Config.activeProfiles = "development";
Config.registerImplicitSource(DefaultConfig);
const {UriBuilder} = require("uu_appg01_core-uri");
const {AuthenticationService, AppClient} = require("uu_appg01_server-client");
const {LoggerFactory} = require("uu_appg01_core-logging");

const logger = LoggerFactory.get("BookKitManagement");

async function appClientPost(uri, dtoIn, options) {
  let attempt = 1;
  let lastError;
  do {
    try {
      return await AppClient.post(uri, dtoIn, options);
    } catch (e) {
      lastError = e;
      logger.debug(`Error during command call: ${JSON.stringify(e, null, 2)}`);
      const status = e.status;
      if (status !== 502 && status !== 404) {
        throw e;
      } else {
        logger.warn(`Error during command call: ${status} - ${e.message}`);
        await new Promise(r => setTimeout(r, 2000));
        attempt++;
      }
    }
  } while (attempt <= 5);
  throw lastError;
}

async function appClientGet(uri, dtoIn, options) {
  return await AppClient.get(uri, dtoIn, options);
}

async function _setPageState(bookUri, pageCode, state, session) {
  let command = "updatePage";
  let commandUri = UriBuilder.parse(bookUri).setUseCase(
    command).toUri();
  let options = {session};
  let dtoIn = {
    code: pageCode,
    state: state
  };
  await appClientPost(commandUri, dtoIn, options);
}

async function setPageState(bookUri, rootPageCodes, state) {
  console.info(`Setting state to all pages under page with codes "${rootPageCodes}" to ${state}.`);
  let session = await _getUserSessions();
  let menu = await _loadMenu(bookUri, session);
  for(const rootPageCode of rootPageCodes) {
    let selectedPages = _loadPagesUnderRoot(menu, rootPageCode);
    console.info(`Selected pages: ${selectedPages}`);
    let pagesToSetState = _filterOutByState(selectedPages, state);
    console.info(`Pages to set state: ${pagesToSetState}`);
    for(const page of pagesToSetState) {
      await _setPageState(bookUri, page.code, state, session);
    }
  }
  console.info("Triggering fulltext index update.");
  await updateFulltextIndex(bookUri, session);
  console.info(`Operation finished.`);
}

async function updateFulltextIndex(bookUri, session) {
  let command = "updateBookIndex";
  let commandUri = UriBuilder.parse(bookUri).setUseCase(
      command).toUri();
  let options = {session};
  await appClientPost(commandUri, null, options);
}

async function _deletePage(bookUri, pageCode, session) {
  let command = "deletePage";
  let commandUri = UriBuilder.parse(bookUri).setUseCase(
      command).toUri();
  let options = {session};
  let dtoIn = {
    code: pageCode
  };
  await appClientPost(commandUri, dtoIn, options);
}

async function deleteEntries(bookUri, rootPageCodes) {
  console.info(`Deleting all pages under page with codes "${rootPageCodes}" in book ${bookUri}.`);
  let session = await _getUserSessions();
  let menu = await _loadMenu(bookUri, session);
  for(const rootPageCode of rootPageCodes) {
    let selectedPages = _loadPagesUnderRoot(menu, rootPageCode);
    console.info(`Selected pages: ${selectedPages}`);
    for(const page of selectedPages) {
      if (page.state === "closed") {
        console.info(`Deleting ${page.code}...`);
        await _deletePage(bookUri, page.code, session);
      } else {
        console.error(`Page ${page.code} won't be deleted because it is not in closed state.`);
      }
    }
  }
  console.info(`Deleting of pages finished. Check the log outputs to see if there were any errors / warnings.`);
}


async function _getUserSessions() {
  return await AuthenticationService.authenticate();
}

async function _loadMenu(bookUri, session) {
  let command = "getBookStructure";
  let commandUri = UriBuilder.parse(bookUri).setUseCase(
    command).toUri();
  let options = {session};

  let response = await appClientGet(commandUri, null, options);
  return response.data.itemMap;
}

function _loadPagesUnderRoot(bookMenu, rootPage) {
  let currentPage = bookMenu[rootPage];
  if (!currentPage) {
    console.warn(`Page with code ${rootPage} does not exist. Skipping...`);
    return [];
  }
  let rootIndent = currentPage.indent;
  // filter by page.state (!= newState)
  console.info(`Current page: ${currentPage}`);
  //always add the root page since it won't be added due to its indent
  let result = [new BookPage(rootPage, currentPage)];
  if(currentPage.next) {
    result.push(..._loadSubPages(bookMenu, currentPage.next, rootIndent + 1));
  }
  return result;
}

function _loadSubPages(bookMenu, page, minIndent) {
  let result = [];
  let currentPage = bookMenu[page];
  if(currentPage.indent < minIndent) {
    return [];
  }
  result.push(new BookPage(page, currentPage));
  let next = currentPage.next;
  if(next) {
    let nextPages = _loadSubPages(bookMenu, next, minIndent);
    result.push(...nextPages);
  }
  return result;
}

function _filterOutByState(pages, state) {
  let result = [];
  for (const page of pages) {
    if(page.state !== state) {
      result.push(page);
    }
  }
  return result;
}

class BookPage {

  constructor(pageCode, details) {
    this.code = pageCode;
    this.state = details.state;
  }

  toString() {
    return `Code: ${this.code}, state: ${this.state}`;
  }
}

module.exports = {
  setPageState, deleteEntries
};



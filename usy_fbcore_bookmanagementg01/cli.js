#!/usr/bin/env node

let {setState, deleteEntries} = require("./app/bookKitMng");
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");


const parametersdefinitions =[
  {
    name: 'action',
    alias: "a",
    type: String,
    typeLabel: "{underline help}",
    description: "Action to execute (setState, delete)."
  },
  {
    name: "book",
    alias: "b",
    type: String,
    typeLabel: "{underline bookUri}",
    description: "URI to the book."
  },
  {
    name: "rootPage",
    alias: "p",
    type: String,
    multiple: true,
    typeLabel: "{underline welcome}",
    description: "Code of the root page."
  },
  {
    name: "state",
    alias: "s",
    typeLabel: "{underline active}",
    description: "State to set.",
    type: String
  },
  {
    name: "help",
    alias: "h",
    type: Boolean,
    description: "Displays this usage guide."
  }
];


const cliDefinition = [
  ...parametersdefinitions
];
const sections = [
  {
    header: "book-manager",
    content: "Provides bulk management functions for BookKit."
  },
  {
    header: "Synopsis",
    content: [
      "book-manager {bold --book} {underline bookUri} {bold --rootPage} {underline welcome} {bold --state} {underline active}",
      "book-manager {bold --help}"
    ]
  },
  {
    header: "Parameters",
    optionList: parametersdefinitions
  }
];
const usage = commandLineUsage(sections);
const options = commandLineArgs(cliDefinition);

const valid = options.help || (options.book && options.rootPage && options.state);
if (!valid || options.help) {
  console.log(usage);
  process.exit();
}

switch (options.action) {
  case 'setState':
    setState(options.book, options.rootPage, options.state);
    break;
  case 'delete':
    deleteEntries(options.book, options.rootPage);
    break;
  case 'help':
    console.log(usage);
    break;
  default:
    console.error('Unknown operation. Use "help" for usage information.');
    process.exit(1);
}

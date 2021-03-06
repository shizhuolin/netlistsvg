#!/usr/bin/env node
'use strict';

var lib = require('../built'),
    fs = require('fs'),
    path = require('path'),
    json5 = require('json5'),
    yargs = require('yargs'),
    Ajv = require('ajv');

var ajv = new Ajv({allErrors: true, jsonPointers: true});
require('ajv-errors')(ajv);

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file]')
        .argv;

    main(argv._[0], argv.o, argv.skin);
}

function render(skinData, netlist, outputPath) {
    lib.render(skinData, netlist, (err, svgData) => {
        if (err) throw err;
        fs.writeFile(outputPath, svgData, 'utf-8', (err) => {
            if (err) throw err;
        });
    });
}

function parseFiles(skinPath, netlistPath, callback) {
    fs.readFile(skinPath, 'utf-8', (err, skinData) => {
        if (err) throw err;
        fs.readFile(netlistPath, (err, netlistData) => {
            if (err) throw err;
            callback(skinData, netlistData);
        });
    });
}

function main(netlistPath, outputPath, skinPath) {
    skinPath = skinPath || path.join(__dirname, '../lib/default.svg');
    outputPath = outputPath || 'out.svg';
    var schemaPath = path.join(__dirname, '../lib/yosys.schema.json5');
    parseFiles(skinPath, netlistPath, (skinData, netlistString) => {
        var netlistJson = json5.parse(netlistString);
        var valid = ajv.validate(json5.parse(fs.readFileSync(schemaPath)), netlistJson);
        if (!valid) {
            throw Error(JSON.stringify(ajv.errors, null, 2));
        }
        render(skinData, netlistJson, outputPath);
    });
}

module.exports.main = main;

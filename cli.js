#!/usr/bin/env node

const program = require('commander')
const assert = require('assert').strict;
const runner = require('./runner')

parse_command_line = () => {
  let res = {}
  res.binary = process.argv[2]
  const argv = process.argv
  program
    .option('--gtest_filter <type>', 'test filter')

  let end = argv.indexOf('--')
  if (end==-1) {
    end = argv.length
  } else {
    res.additional_args = argv.slice(end+1)
  }
  program.parse(argv.slice(0, end))
  res.gtest_filter = program.gtest_filter
  return res
}

var failed = []
var passed = []

cli = parse_command_line()
runner.runGtests(cli.binary, cli.gtest_filter, cli.additional_args, (test) => {
  assert.ok(test.is_complete)
  if (test.error) {
    console.log(`FAIL ${test.tests}`)
    console.log(`Error ${test.error}`)
    console.log(test.stdout)
    console.log(test.stderr)
    failed.push(test.tests)
  } else {
    passed.push(test.tests)
    console.log(`Passed ${test.tests}`)
  }
  console.log(`Failed tests ${failed.length}`)
  console.log(failed)
  console.log(`${passed.length} tests passed`)
})

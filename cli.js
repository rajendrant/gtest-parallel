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

cli = parse_command_line()
gtest = runner.runGtests(cli.binary, cli.gtest_filter, {additional_args: cli.additional_args}, process.cwd())
gtest.on('testlist', testlist => {
  console.log('testlist', testlist)
})
gtest.on('result', result => {
  assert.ok(result.is_complete)
  if (result.error) {
    console.log(`FAIL ${result.tests}`)
    console.log(`Error ${result.error}`)
    console.log(result.stdout)
    console.log(result.stderr)
  }
})
gtest.on('finish', (passed, failed) => {
  if (failed.length)
    console.log(`Failed tests ${failed.length}`)
  if (passed)
    console.log(`${passed.length} tests passed`)
})

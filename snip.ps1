#!/usr/bin/env pwsh
$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition
node "$dir\cli.js" @args

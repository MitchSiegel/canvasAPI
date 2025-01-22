#!/bin/bash

cd "$(dirname "$0")"  # Navigate to the script's directory
npm install            # Ensure dependencies are installed
node index.js --all     # Start your application

# Close the terminal window
osascript -e 'tell application "Terminal" to close first window' & exit
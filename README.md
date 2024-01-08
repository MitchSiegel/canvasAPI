# Canvas -> ClickUp

My final goal of this repository is to make a program that takes my assignments from canvas and puts them into my task management software, in this case, it will be clickup.

This repository is a work in progress, and I will be updating it as I go along.

Completed Features: 
- [x] UI for all of this
- [x] Pull all needed data from Canvas
- [x] Pull all needed data from ClickUp
- [x] Hide courses you don't want to see
- [x] Add assignments to ClickUp
- [x] Check for duplicates
- [x] Add a cutoff date for adding assignments
- [x] Save to JSON file to avoid calling the API every time
- [x] Detailed progress when adding assignments (possible with WebSockets)
- [x] Support nicknames for courses 
- [x] Better UI updates to show progress
- [x] Add a way to ignore assignments that contain certain words
- [x] Added support for just importing tasks from JSON data. 


Features that can't be added:
- OAuth2.0 for Canvas (Cannot generate client IDs as a student)
# How to use 

### Pre-requisites
1. [Node.js](https://nodejs.org/en/) is required to run this program.
2. You need a [ClickUp API Key](https://docs.clickup.com/en/articles/1367130-getting-started-with-the-clickup-api) and a [Canvas API Key](https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273) to use this program.

That's it!
### Installation
1. Clone this repository
2. Run `npm install` in the root directory of the repository
3. Run `npm start` to start the program
4. Program will open in your default browser
5. You'll need to enter your API keys and other settings in the UI, which is in the top right corner of the screen.

### Bulk Importing Tasks
This feature allows you to easily add tasks from the JSON format. This was created as I often have repeating tasks that I need to add to ClickUp, and aren't on Canvas. For example, weekly WebAssign assignments.

Tasks follow this JSON structure:
```json 
{
    "name": "Task Name",
    "dueAt": 1704817552642, // Due date in milliseconds
    "clickUpListId": 123456789, // There is a list of list IDs in the UI on the add tasks in bulk page.
    "url": "https://example.com", // URL to the task (optional) - also this just adds to the description, so you can technically add anything here
},
//Example
[{
    "name": "WebAssign 1",
    "dueAt": 1704817552642,
    "clickUpListId": 123456789,
    "url": "https://example.com",
}]
```
To use this feature, click the star icon in bottom right, next to the plus icon. This will open a popup with a textarea in it. Paste your JSON array of tasks into the textarea and click "Add bulk". The program will then add all of the tasks to ClickUp. You will see progress in the same textarea you pasted the data into.

### Persistent Data
Data is stored in a JSON filed called "persistent.json". This file is created and managed automatically, however, I have included in the structure below. All of the settings are configurable in the UI, so you don't need to worry about this file unless you want to.

```json
{
    "Settings":{
        "ignore":[-1], // List of courses to ignore, by ID. Always has -1 in it, this is done to avoid errors
        "canvasKey": "", // Canvas API Key
        "clickUpKey": "", // ClickUp API Key
        "clickUp":{ //stores data related to clickUp.
            "spaces": [ // Cache of all spaces
                {
                    "id": 0, 
                    "name": "", 
                    "lists": [ // Cache of all lists in the space
                        {
                            "id": 0,
                            "name": ""
                        },
                    ] 
                },
            ],
            "defaultSpaceId": 0, // Default space to add assignments to
            "defaultListId": 0, // Default list to add assignments to (unused right now)
            "userID": 0 // ClickUp user ID
        }
    },
    "Courses": [ // Cache of all courses
        {
            "name": "",
            "id": 0,
        }
    ],
    "lastPullDate": "2024-01-01T00:00:00.000Z" // Date of last pull from Canvas, used to determine if classes should be re-pulled from Canvas, default is every 30 days
}
```
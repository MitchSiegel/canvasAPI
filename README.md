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

Features to be added:
- [ ] monday.com support is in the works 

Features that can't be added:
- OAuth2.0 for Canvas (Cannot generate client IDs as a student)
## How to use & other random info
(in progress)

You need Node.js installed to run this program. You should also have a Canvas API key and a ClickUp API key. You can get both of these from your respective accounts. 
I am unable to use OAuth from Canvas as a student, so you'll need to find to a way to generate a [Canvas API Key](https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273).

### Data Storage 
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
    "lastPullDate": "2023-01-01T00:00:00.000Z" // Date of last pull from Canvas, used to determine if classes should be re-pulled from Canvas, default is every 30 days
}
# canvasToClickUp

My final goal of this repository is to make a program that takes my assignments from canvas and puts them into my task management software, in this case, it will be clickup.

This repository is a work in progress, and I will be updating it as I go along.

Feature progress: 
- [x] UI for all of this
- [x] Pull all needed data from Canvas
- [x] Pull all needed data from ClickUp
- [x] Hide courses you don't want to see
- [x] Add assignments to ClickUp
- [x] Check for duplicates
- [x] Add a cutoff date for adding assignments
- [x] Save to JSON file to avoid calling the API every time
- [ ] Add a way to ignore assignments that contain certain words
- [ ] Better UI updates to show progress
- [ ] Oauth2 for Canvas (? possibly but im lazy)
- [ ] Oauth2 for ClickUp (see above)
- [ ] Support canvas class nicknames


## How to use
(in progress)

You need Node.js installed to run this program. You should also have a Canvas API key and a ClickUp API key. You can get both of these from your respective accounts. Technically I should be oauth, but because everything is local, I thought this would be fine (However, Canvas doesn't quite agree, so im not really supposed to tell you to just input your canvas access token, [but it should would be a bummer if someone linked you the  exact instructions on how to get it.](https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273) )
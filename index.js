import fetch from 'node-fetch'; //handles http requests
import moment from 'moment'; //handles dates
import open from 'open'; //open the browser
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import express from 'express'; //handles web interface and api
import { promises as fs, existsSync as existsSync} from 'fs'; //handles file system
import ejs from 'ejs';
dotenv.config() // load environment variables from .env file

const app = express();
app.set("view engine", "ejs");
app.use(express.static('public'));

let firstLoad = true;
let persistentFile = "persistent.json"; //file to store data in
let Settings = {};
let Courses = []; //array of courses
//let Spaces = []; //array of spaces


//classes start 

class Course {
    constructor(name, id, icsURL) {
        this.name = name;
        this.id = id;
        this.icsURL = icsURL;
        this.Assignments = [];
    }

    //add an assignment to the course
    addAssignment(assignment) {
        this.Assignments.push(assignment);
    }

    //get the assignments from the course
    getAssignments() {
        return this.Assignments;
    }

    //print course info
    print() {
        console.log(this.name);
        console.log(this.id);
        console.log(this.icsURL);
        console.log(this.Assignments);
    }

    //get course id
    getId() {
        return this.id;
    }
}

class Assignment {
    constructor(name, dueDate, submissionType,url) {
        this.name = name;
        this.dueDate = dueDate;
        this.submissionType = submissionType;
        this.url = url;
    }
}

//clickUp Spaces class
class Space {
    constructor(name, id) {
        this.name = name;
        this.id = id;
        this.lists = [];
    }

    //add a list to the space
    addList(list) {
        this.Lists.push(list);
    }

    //get the lists from the space
    getLists() {
        return this.lists;
    }
}

//clickUp Lists class
class List {
    constructor(name, id) {
        this.name = name;
        this.id = id;
    }
}

//classes end

//check if persistent file exists, if not create it
if(!existsSync(persistentFile)){
    console.error('Persistent file does not exist, creating...');

    let fileData = {
        Settings: {
            ignore: [-1],
            canvasKey: "",
            clickUpKey: "",
            clickUp:
            {
                teamId: "",
                spaces: [],
                defaultSpaceId: "",
                defaultListId: ""
            }
        },
        Courses: [],
        lastPullDate: null
    }
    fs.writeFile(persistentFile, JSON.stringify(fileData));
}else{
    fs.readFile(persistentFile, 'utf8').then((data) => {
        Settings = JSON.parse(data).Settings;
    })
    
    if(Settings.canvasKey == "" || Settings.clickUpKey == "") {
        console.error("!!! Canvas key or ClickUp key not set, please set them in the persistent json file. !!! (or in settings on the web interface)");
        //process.exit(1); - decided not to exit because it's annoying
    }
}



async function loadCourses(forcePull) {
    //pull from persistent file if it exists, and check to see if date is more than 30 days old (we don't need to pull from canvas every time)
    let fileData = await fs.readFile(persistentFile, 'utf8')
    fileData = JSON.parse(fileData);
    Settings = fileData.Settings; //load settings from persistent file
    if (fileData.lastPullDate != null && moment().diff(moment(fileData.lastPullDate), 'days') <= 30 && !forcePull) { //if the last pull date is more than 30 days ago, pull from canvas
        console.log("Pulling courses from persistent file...");
        let courseCount = 0;
        for(let i = 0; i < fileData.Courses.length; i++) {
            if(!Settings.ignore.includes(String(fileData.Courses[i].id))){ //this is not working for some reason
                Courses[courseCount] = new Course(fileData.Courses[i].name,fileData.Courses[i].id,fileData.Courses[i].icsURL);
                courseCount++;
            }
        }
    } else {

    console.log("Pulling courses from canvas...");
    if(Settings.canvasKey == ""){ //check if canvas key is set
        console.error("Unable to pull from canvas, canvas key not set.");
        return;
    }
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + Settings.canvasKey); 
    
    var requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };
    
    let response = await fetch("https://canvas.colorado.edu/api/v1/courses", requestOptions)
    let data = await response.json();
    //create a course object for each course
    for (let i = 0; i < data.length; i++) {
        if(data[i].calendar == null) continue; //skip courses that don't have an ics file
        let course = new Course(data[i].name, data[i].id, data[i].calendar.ics);
        if(!Settings.ignore.includes(course.getId())){
            Courses.push(course);
        }
    }
    //write to persistent file
    fileData.Courses = Courses;

    if(Courses.size == 0){
        fileData.lastPullDate = null; //set the last pull date to null if no courses were pulled
    } else{
        fileData.lastPullDate = moment().format(); //set the last pull date to the current date
    }


    await fs.writeFile(persistentFile, JSON.stringify(fileData));
    }
}

async function loadAssignments(course) {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + Settings.canvasKey);

    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };
    let courseID = course.getId();
    let response = await fetch(`https://canvas.colorado.edu/api/v1/courses/${courseID}/assignments?order_by=due_at&bucket=future`, requestOptions);
    let data = await response.json();
    for (let j = 0; j < data.length; j++) {
    let assignment = new Assignment(data[j].name, data[j].due_at, data[j].submission_types, data[j].html_url);

    course.addAssignment(assignment);
    }
}

async function getClickUpTeamId(forcePull){
    if(Settings.clickUpKey == "") return;
    if(Settings.clickUp.teamId != "" && !forcePull){
        console.log("Pulling team id from persistent file...");
        return Settings.clickUp.teamId; //if the team id is already set, return it (and don't pull from clickup)
    }
    console.log("Pulling team id from clickup...");
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", Settings.clickUpKey);
    
    var requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };
    
    let responseData = await fetch("https://api.clickup.com/api/v2/team", requestOptions);
    let data = await responseData.json();
    Settings.clickUp.teamId = data.teams[0].id;
    saveSettings();
    return data.teams[0].id;
}

async function getClickUpSpaces(forcePull){
    if(Settings.clickUpKey == "") return;
    if(Settings.clickUp.spaces.length > 0 && !forcePull){
        console.log("Pulling spaces from persistent file...");
        return Settings.clickUp.spaces; //if the spaces are already set, return them (and don't pull from clickup)
    }
    //if the spaces are not set, pull from clickup, or if forcePull is true. either way we need to make sure the spaces are empty
    Settings.clickUp.spaces = [];
    console.log("Pulling spaces from clickup...");
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", Settings.clickUpKey);
    
    var requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow'
    };
    
    let responseData = await fetch(`https://api.clickup.com/api/v2/team/${Settings.clickUp.teamId}/space`, requestOptions);
    let data = await responseData.json();
    for(let i = 0; i < data.spaces.length; i++){
        let space = new Space(data.spaces[i].name, data.spaces[i].id);
        Settings.clickUp.spaces.push(space);
    };
    saveSettings();
    return data.spaces;
}

async function getClickUpLists(forcePull){
    forcePull = forcePull || false;
    if(Settings.clickUpKey == "") return;
    if(Settings.clickUp.spaces.length > 0 && !forcePull){ //if the spaces are already set, and we don't want a force pull, we can now check to see if there are any lists in the spaces
        let doesSpaceHaveNoLists = false; //basically we want to pull if there a space that has no lists
        for(let i = 0; i < Settings.clickUp.spaces.length; i++){
            if(Settings.clickUp.spaces[i].lists.length == 0){ 
                doesSpaceHaveNoLists = true;
                break;
            }
        }
        if(!doesSpaceHaveNoLists) {
            console.log("Pulling lists from persistent file...");
            return Settings.clickUp.spaces; //if there are lists in the spaces, return them
        }
    }
    console.log("Pulling lists from clickup...")
    if(Settings.clickUp.spaces.length == 0) return; //if there are no spaces, return
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", Settings.clickUpKey);
    
    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };
    //clear old lists
    for(let i = 0; i < Settings.clickUp.spaces.length; i++){
        Settings.clickUp.spaces[i].lists = [];
    }
    for(let i = 0; i < Settings.clickUp.spaces.length; i++){
        let responseData = await fetch(`https://api.clickup.com/api/v2/space/${Settings.clickUp.spaces[i].id}/list`, requestOptions);
        let data = await responseData.json();
        for(let j = 0; j < data.lists.length; j++){
            let list = new List(data.lists[j].name, data.lists[j].id);
            Settings.clickUp.spaces[i].lists.push(list);
        }
    }
    saveSettings();
    return Settings.clickUp.spaces;
}

//function to save settings to persistent file
async function saveSettings() {
    let fileData = await fs.readFile(persistentFile, 'utf8');
    fileData = JSON.parse(fileData);
    fileData.Settings = Settings;
    await fs.writeFile(persistentFile, JSON.stringify(fileData));
}
//handle all of the routes
app.get('/', async(req, res) => {
    if(firstLoad) {
        await loadCourses(false);
        //loadAssignments(Courses[0]);
        //console.log("assigments:", Courses[0].Assignments);
        firstLoad = false;
        await getClickUpTeamId();
        await getClickUpSpaces();
        await getClickUpLists();
    }
    let filteredCourses = [];
    for(let i = 0; i < Courses.length; i++) {
        if(!Settings.ignore.includes(Courses[i].getId())){
            filteredCourses.push(Courses[i]);
        }
    }
    res.render('index', {Courses: filteredCourses, canvasKey: Settings.canvasKey, clickUpKey: Settings.clickUpKey, clickUp: Settings.clickUp});
});

//api to hide a course
app.get('/api/hide/:id', async(req, res) => {

    let id = req.params.id;
    //unhide all courses if the id is -1

    let fileData = await fs.readFile(persistentFile, 'utf8');
    fileData = JSON.parse(fileData);
    if(!fileData.Settings.ignore.includes(id)){ //if the course is not already in the ignore list, add it   
        Settings.ignore.push(Number(id));
        fileData.Settings.ignore.push(id);
    }
    //crashes if there all courses are hidden, so we need to keep at least one course not hidden //TODO: fix this

    if(id == -1) {
        Settings.ignore = [];
        fileData.Settings.ignore = [];
    }
    await fs.writeFile(persistentFile, JSON.stringify(fileData));
    res.json({success: true});
});

//api to save clickup or canvas key
app.get('/api/saveKey/:keyType/:key', async(req, res) => {
    let keyType = req.params.keyType;
    let key = req.params.key;
    if(keyType == "canvas" && key != "") {
        Settings.canvasKey = key;
        await saveSettings();
        res.json({success: true});        
    } else if(keyType == "clickup" && key != "") {
        Settings.clickUpKey = key;
        await saveSettings();
        res.json({success: true});
    } else if(keyType == "defaultClickUpSpace" && key != "") {
        Settings.clickUp.defaultSpaceId = key;
        await saveSettings();
        res.json({success: true});
    } else {
        res.json({success: false});
        return;
    }
});

app.get("/forceClickUpPull", async(req, res) => {
    await getClickUpSpaces(true);
    await getClickUpLists(true);
    res.json({success: true});
});
//start the server, either on port 3000 or the port specified in the environment variables
app.listen(process.env.PORT || 3001, () => {
    console.log(`Server started on port ${process.env.PORT || 3001}`);
})

if(process.env.NODE_ENV !== 'production') {
   // open(`http://localhost:${process.env.PORT || 3000}`); //only open the browser if we are not in production
}
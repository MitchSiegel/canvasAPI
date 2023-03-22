import fetch from 'node-fetch'; //handles http requests
import moment from 'moment'; //handles dates
import open from 'open'; //open the browser
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import express from 'express'; //handles web interface and api
import { promises as fs, existsSync as existsSync} from 'fs'; //handles file system
import ejs from 'ejs';
dotenv.config() // load environment variables from .env file
import colors from 'colors';
import {compareTwoStrings, findBestMatch} from 'string-similarity';

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

    //get course name
    getName() {
        return this.name;
    }

}

class Assignment {
    constructor(name, dueDate, submissionType,url) {
        this.name = name;
        this.dueDate = dueDate;
        //convert due date to local time, and then to seconds for clickUp
        this.clickUpDueDate = moment(dueDate).local().format('x');
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
                userId:"",
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
        console.log("[ERROR]".red + " Canvas key or ClickUp key not set, please set them in the persistent json file. (or in settings on the web interface".white);
    }
}



async function loadCourses(forcePull) {
    //pull from persistent file if it exists, and check to see if date is more than 30 days old (we don't need to pull from canvas every time)
    let fileData = await fs.readFile(persistentFile, 'utf8')
    fileData = JSON.parse(fileData);
    Settings = fileData.Settings; //load settings from persistent file
    if (fileData.lastPullDate != null && moment().diff(moment(fileData.lastPullDate), 'days') <= 30 && !forcePull) { //if the last pull date is more than 30 days ago, pull from canvas
        let courseCount = 0;
        for(let i = 0; i < fileData.Courses.length; i++) {
            if(!Settings.ignore.includes(String(fileData.Courses[i].id))){ //this is not working for some reason
                Courses[courseCount] = new Course(fileData.Courses[i].name,fileData.Courses[i].id,fileData.Courses[i].icsURL);
                courseCount++;
            }
        }
        console.log("[LOCAL]".magenta + " Courses loaded".white);
    } else {
    console.log("[CANVAS]".yellow + " Pulling courses from canvas".white);
    if(Settings.canvasKey == ""){ //check if canvas key is set
        console.error("Unable to pull from canvas, canvas key not set.".red);
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
    //gotta purge the assignments from the course
    if(course.getAssignments().length > 0){
        console.log("[LOCAL]".magenta + " Assignments already loaded for course: ".white + course.getId().toString().yellow);
        return course.getAssignments();
    }
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + Settings.canvasKey);

    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };
    let courseID = course.getId();
    console.log("[CANVAS]".yellow + " Pulling assignments from canvas for course: ".white + courseID.toString().yellow);
    let response = await fetch(`https://canvas.colorado.edu/api/v1/courses/${courseID}/assignments?order_by=due_at&bucket=future`, requestOptions);
    let data = await response.json();
    for (let j = 0; j < data.length; j++) {
    let assignment = new Assignment(data[j].name, data[j].due_at, data[j].submission_types, data[j].html_url);
    course.addAssignment(assignment);
    }
    console.log("[CANVAS]".yellow + " Assignments pulled from canvas for course: ".white + courseID.toString().yellow);
}

async function getClickUpTeamId(forcePull){
    if(Settings.clickUpKey == "") return;
    if(Settings.clickUp.teamId != "" && !forcePull){
        console.log("[LOCAL]".magenta + " ClickUp Team ID loaded".white);
        return Settings.clickUp.teamId; //if the team id is already set, return it (and don't pull from clickup)
    }
    console.log("[CLICKUP]".green + " ClickUp Team ID loading from clickup".white)
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
    Settings.clickUp.userId = data.teams[0].members[0].user.id;
    saveSettings();
    return data.teams[0].id;
}

async function getClickUpSpaces(forcePull){
    if(Settings.clickUpKey == "") return;
    if(Settings.clickUp.spaces.length > 0 && !forcePull){
        console.log("[LOCAL]".magenta + " ClickUp Spaces loaded".white);
        return Settings.clickUp.spaces; //if the spaces are already set, return them (and don't pull from clickup)
    }
    //if the spaces are not set, pull from clickup, or if forcePull is true. either way we need to make sure the spaces are empty
    Settings.clickUp.spaces = [];
    console.log("[CLICKUP]".green + " ClickUp Spaces loading".white);
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
    console.log("[CLICKUP]".green + " ClickUp Spaces loaded".white);
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
            console.log("[LOCAL]".magenta + " ClickUp Lists loaded".white)
            return Settings.clickUp.spaces; //if there are lists in the spaces, return them
        }
    }
    console.log("[CLICKUP]".green + " ClickUp Lists loading".white);
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
    console.log("[CLICKUP]".green + " ClickUp Lists loaded".white);
    return Settings.clickUp.spaces;
}

async function createClickUpTask(name, description, due, listId){
    if(isNaN(due)){
        return {body: {}, code: 100};
    }
    let url = `https://api.clickup.com/api/v2/list/${listId}/task`;
    let headers = {
        'Content-Type': 'application/json',
        'Authorization': Settings.clickUpKey,
    };
    let body = {
        "name":  name,
        "description": description,
        "assignees": [
            Number(Settings.clickUp.userId)
        ],
        "due_date": due,
        "due_date_time": true,
        //"start_date": task.startTime, TODO
        //"start_date_time": true,
        "notify_all": false,
        "parent": null,
        "links_to": null,
        "custom_fields": []
    };
    
    const options = {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    };
    let response = await fetch(url, options)
    //log the response from the api
    let json = await response.json();
    if(response.status != 200){
        console.log(json)
        console.log(response)
        console.log(body)
    }
    return {body: json, code: response.status};
};

async function getClickUpListTasks(listId){
    if(Settings.clickUpKey == "") return;
    if(Settings.clickUp.spaces.length == 0) return;
    console.log("[CLICKUP]".green + " Loading tasks for list ID".white + ` ${listId}`.green);
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", Settings.clickUpKey);

    var requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };

    let responseData = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, requestOptions);
    let data = await responseData.json();
    let taskNames = [];
    for(var i = 0; i < data.tasks.length; i++){
        taskNames.push(data.tasks[i].name);
    }
    if(taskNames.length == 0) taskNames.push("No tasks");
    console.log("[CLICKUP]".green + " Loaded tasks for list ID".white + ` ${listId}`.green);
    return taskNames;
    
}
//function to save settings to persistent file
async function saveSettings() {
    let fileData = await fs.readFile(persistentFile, 'utf8');
    fileData = JSON.parse(fileData);
    fileData.Settings = Settings;
    await fs.writeFile(persistentFile, JSON.stringify(fileData));
}
//load in initial data, must be done before the server starts, and in order
loadCourses().then(() => {
    getClickUpTeamId().then(() => {
        getClickUpSpaces().then(() => {
            getClickUpLists();
        });
    });
});


//index page
app.get('/', async(req, res) => {
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
        console.log("[API]".cyan + " Un-hiding all courses".white);
        Settings.ignore = [-2];
        fileData.Settings.ignore = [-2];
    }else{
        console.log("[API]".cyan + " Hiding course with id: ".white + req.params.id.cyan);
    }
    await fs.writeFile(persistentFile, JSON.stringify(fileData));
    res.json({success: true});
});

//api to save clickup or canvas key (from web UI)
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

app.get("/api/getAssignments/:courseId", async(req, res) => {
    console.log("[API]".cyan + " Getting assignments for course with id: ".white + req.params.courseId.cyan)
    let courseId = req.params.courseId;
    let course = Courses.find(course => course.getId() == courseId);
    if(course == undefined) {
        res.json({success: false});
        return;
    }
    //temporarily disabled, as im styling it in the frontend and don't want so many requests
    await loadAssignments(course);
    res.json({success: true, assignments: course.Assignments,courseName: course.getName()});
    //es.json({success: true, assignments: [], );
});

app.get("/api/generate", async(req, res) => {
    //all things here are passed by query, we need to get them all
    let courseId = req.query.courseID;
    let clickUpList = req.query.clickUpList;
    //future feature but still keeping this code here, ignoreDuplicates is a setting that will ignore duplicate assignments, and is passed to this url as a query parameter, it is optional
    let ignoreDuplicates = req.query.ignoreDuplicates || false;
    let cutOffDate = req.query.cutOffDate;
    if(cutOffDate == "none") {
        cutOffDate = undefined;
    }else{
        cutOffDate = new moment(cutOffDate);
        console.log(cutOffDate);
    }
    //a lot of things are required for this to work, so we need to check if they are all there
    //find course and make sure its valid
    let course = Courses.find(course => course.getId() == courseId);
    if(course == undefined) {
        res.json({success: false, error: "Invalid course id"});
        return;
    }
    if(course.getAssignments().length == 0) {
        res.json({success: false, error: "No assignments found for course"});
        return;
    }
    //find clickup list and make sure its valid
    let list = undefined;
    for(let i=0; i < Settings.clickUp.spaces.length; i++) {
        let space = Settings.clickUp.spaces[i];
        for(let j=0; j < space.lists.length; j++) {
            if(space.lists[j].id == clickUpList) {
                list = space.lists[j];
            }
        }
    }
    if(list == undefined) {
        res.json({success: false, error: "Invalid clickup list id"});
        return;
    }
    let clickUpTasks = ["none"];
    //we really only need to get the tasks if we are ignoring duplicates. Getting the task will slow down the process, so we only want to do it if we need to
    if(ignoreDuplicates == "true") {
        clickUpTasks = await getClickUpListTasks(list.id);
    }
    console.log("[API]".cyan + " Generating ClickUp Tasks for".white + " course ".white + course.getName().yellow + " and ClickUp list ".white + String(list.name).green);
    let createdAllTasks = true;
    //we need to loop through the assignment list and create a new assignment for each one
    let assignments = course.getAssignments();
    for(let i=0; i < assignments.length; i++) {
        if(ignoreDuplicates == "true") {
            //check if the assignment already exists in clickup
            let a = findBestMatch(assignments[i].name, clickUpTasks);
            if(a.bestMatch.rating > 0.85) {
                console.log("[GENERATION]".blue + " Skipping task ".white + String(a.bestMatch.target).blue + " because it already exists in ClickUp".white);
                continue;
            }
        }
        if(cutOffDate != undefined) {
            if(moment(assignments[i].dueDate).isAfter(cutOffDate)) {
                console.log("[GENERATION]".blue + " Skipping task ".white + String(assignments[i].name).blue + " because it is after the cutoff date".white);
                continue;
            }
        }
        let task = await createClickUpTask(assignments[i].name, assignments[i].url, assignments[i].clickUpDueDate, list.id); //create the task
        if(task.code != 200 && task.code != 100 /* 100 is the code im using to track invalid dates, but we don't need to say it failed */){
            console.log("[GENERATION] Error creating task: ".red);
            createdAllTasks = false;
            continue;
        }else{
            if(task.body.id != undefined){
                console.log("[GENERATION]".blue + " Created task with id: ".white + String(task.body.id).cyan + " in list ".white + String(list.name).cyan);
            }else{
                console.log("[GENERATION]".blue + " Skipped assignment with: ".white + String(assignments[i].name).cyan + " due to invalid date".white);
            }

        }
    }
    if(createdAllTasks) {
        res.json({success: true});
    }else{
        res.json({success: false});
    }
});
//start the server, either on port 3000 or the port specified in the environment variables
app.listen(process.env.PORT || 3001, () => {
    console.log("[SERVER]".blue +  ` Server started on port `.white + `${(process.env.PORT || 3001)}`.blue);
})

if(process.env.NODE_ENV !== 'production') {
   // open(`http://localhost:${process.env.PORT || 3000}`); //only open the browser if we are not in production
}

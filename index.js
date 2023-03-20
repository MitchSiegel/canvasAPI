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
//check if persistent file exists, if not create it
if(!existsSync(persistentFile)){
    console.error('Persistent file does not exist, creating...');

    let fileData = {
        Settings: {
            ignore: [],
        },
        Keys:{
            canvasKey: "",
            clickUpKey: ""
        },
        Courses: [],
        lastPullDate: null
    }
    fs.writeFile(persistentFile, JSON.stringify(fileData));
}else{
    fs.readFile(persistentFile, 'utf8').then((data) => {
        Settings = JSON.parse(data).Settings;
    })
    
    if(!Settings.canvasKey || !Settings.clickUpKey) {
        console.error("!!! Canvas key or ClickUp key not set, please set them in the persistent json file. !!!");
        //process.exit(1);
    }
}


//Classes to store data from canvas.
let Courses = []; //array of courses
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

async function loadCourses(forcePull) {
    //pull from persistent file if it exists, and check to see if date is more than 30 days old (we don't need to pull from canvas every time)
    let fileData = await fs.readFile(persistentFile, 'utf8')
    fileData = JSON.parse(fileData);
    Settings = fileData.Settings; //load settings from persistent file
    if (fileData.lastPullDate != null && moment().diff(moment(fileData.lastPullDate), 'days') <= 30 && !forcePull) { //if the last pull date is more than 30 days ago, pull from canvas
        console.log("Pulling from persistent file...");
        let courseCount = 0;
        for(let i = 0; i < fileData.Courses.length; i++) {
            if(!Settings.ignore.includes(String(fileData.Courses[i].id))){ //this is not working for some reason
                Courses[courseCount] = new Course(fileData.Courses[i].name,fileData.Courses[i].id,fileData.Courses[i].icsURL);
                courseCount++;
            }
        }
    } else {

    console.log("Pulling from canvas...");
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Bearer " + process.env.CANVAS_TOKEN); 
    
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
    fileData.lastPullDate = moment().format(); //set the last pull date to the current date

    await fs.writeFile(persistentFile, JSON.stringify(fileData));
    }
}

async function loadAssignments() {
    //load assignments from canvas api and store them in the Courses array (the correct course will be found by the course id)
    for (let i = 0; i < 1; i++) {
        var myHeaders = new Headers();
        myHeaders.append("Authorization", "Bearer " + process.env.CANVAS_TOKEN);

        var requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        let response = await fetch(`https://canvas.colorado.edu/api/v1/courses/${Courses[i].getId()}/assignments?order_by=due_at&bucket=future`, requestOptions)
        let data = await response.json();

        //console.log(data)
        for (let j = 0; j < data.length; j++) {
            let assignment = new Assignment(data[j].name, data[j].due_at, data[j].submission_types, data[j].html_url);

           // console.log(assignment)
            Courses[i].addAssignment(assignment);
        }
    }
    //TODO save assignments to persistent file (can't be bothered to do it right now)
}

//handle all of the routes
app.get('/', async(req, res) => {
    if(firstLoad) {
        await loadCourses(false);
        loadAssignments();
        firstLoad = false;
    }
    let filteredCourses = [];
    for(let i = 0; i < Courses.length; i++) {
        if(!Settings.ignore.includes(Courses[i].getId())){
            filteredCourses.push(Courses[i]);
            console.log(Courses[i].name);
        }
    }
    res.render('index', {Courses: filteredCourses, Keys: keys});
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
    //crashes if there all courses are hidden, so we need to keep at least one course not hidden

    if(id == -1) {
        Settings.ignore = [];
        fileData.Settings.ignore = [];
    }
    await fs.writeFile(persistentFile, JSON.stringify(fileData));
    res.json({success: true});
});
//start the server, either on port 3000 or the port specified in the environment variables
app.listen(process.env.PORT || 3000, () => {
    console.log(`Server started on port ${process.env.PORT || 3000}`);
})

if(process.env.NODE_ENV !== 'production') {
   // open(`http://localhost:${process.env.PORT || 3000}`); //only open the browser if we are not in production
}
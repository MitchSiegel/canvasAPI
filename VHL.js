// html parsing to pull out assignments 

import { load } from 'cheerio';
import { readFileSync } from 'fs';

export default async function doTasks(file){
    let taskArray = [];
    const data = readFileSync(file, 'utf8');
    const $ = load(data);
    const baseURL = "https://m3a.vhlcentral.com"
    
    let tolerance = 40; //days to look ahead
    let now = new Date();
    let future = addDays(new Date(), tolerance);
    var array = $(".c-calendar__month-name").text().trim().split(" ");
    let month = monthToNumber[array[0]], year = array[1];
    
    let rollOver = false; //if calendar is rolling over to next month
    
    const tableList = $('td');
    
    
    // Loop through each <td>
    tableList.each((index, element) => {
        const $element = $(element);
        // Get the date if it exists
        const day = $element.find('.c-day__date').text().trim();
        //build date from month and year
        if(!day) return;
    
        if(day == monthLastDay[month] && !rollOver){
            rollOver = true;
            month = (month + 1) % 12; //rollover to next month
            if(month == 0) year++; //rollover to next year if needed
        }
    
        let dateObj = new Date(year, month, day);
        // Check if the date is within the tolerance
        if((dateObj > now) && (dateObj < future)){ //TODO exit once we are outside the tolerance
            //find data of the requested info
            const name = $element.find('div[data-js-daily="daily"] span.u-dis-none');
            if(name.length == 0) return;
            const time = $element.find('span.c-day__assignment-time').text().trim().split(" ")[0];
            const url = baseURL + $element.find('div[data-js-daily="daily"] a').attr('href');
            const day = $element.attr("data-js-weekday")
    
            //figure out due time, if MWF then 11:00am, if TTh then 8:00pm
    
            if(day == "Mon" || day == "Wed" || day == "Fri"){
                dateObj.setHours(11); //11:00am
            
            }else if(day == "Tue" || day == "Thu"){
                dateObj.setHours(20); //make it 8:00pm cause I don't work later lol
                dateObj.setMinutes(0);
            }
            //new json object
            
            taskArray.push({
                "name": `${name.text().trim()} (${time})`,
                "url": url,
                "dueAt": dateObj.getTime(),
                "clickUpListId": 901108570408
            });
            
        };
    });
    return taskArray;
}
let monthLastDay = {
    0: 31, // January 
    1: 28, // February
    2: 31, // March
    3: 30, // April
    4: 31, // May
    5: 30, // June
    6: 31, // July
    7: 31, // August
    8: 30, // September
    9: 31, // October
    10: 30, // November
    11: 31 // December
};

const monthToNumber = {
    "January": 0,
    "February": 1,
    "March": 2,
    "April": 3,
    "May": 4,
    "June": 5,
    "July": 6,
    "August": 7,
    "September": 8,
    "October": 9,
    "November": 10,
    "December": 11
};

const numberToMonth = {
    0: "January",
    1: "February",
    2: "March",
    3: "April",
    4: "May",
    5: "June",
    6: "July",
    7: "August",
    8: "September",
    9: "October",
    10: "November",
    11: "December"
};


function addDays(date, days) {
    const newDate = new Date(date.valueOf());
    newDate.setDate(newDate.getDate() + days);
    return newDate;
}

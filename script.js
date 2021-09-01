//@ts-check
"use strict";


window.onload = () => tokenCheck();

//Scope for the Authentication thingy
const scope =
    "https://www.googleapis.com/auth/classroom.courses.readonly%20" +
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly%20" +
    "https://www.googleapis.com/auth/classroom.coursework.students.readonly%20" +
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly%20" +
    "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly%20";
const OAuth20 =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    `scope=${scope}&` +
    "include_granted_scopes=true&" +
    "response_type=token&" +
    "state=state_parameter_passthrough_value&" +
    "redirect_uri=https://zhermit09.github.io/Tasker/&" +
    "client_id=82346440292-hlpvrpvqk6epjgqkk93566mdd6mtqocp.apps.googleusercontent.com";
//http://localhost:63342/Tasker/index.html https://zhermit09.github.io/Tasker/
let header = new Headers()
let ongoing = false;
let token

let coursesData = []
let assignments = []
let submissions = []
let timedAssignments = []

const spinner = document.querySelector('header i');

function tokenCheck() {
    //2 step check for session token
    token = JSON.parse(sessionStorage.getItem("Token"));
    if (token === null) {
        sessionStorage.setItem("Token", JSON.stringify(new URLSearchParams(window.location.hash).get('access_token')));
        token = JSON.parse(sessionStorage.getItem("Token"));
        if (token === null) {
            window.location.replace(OAuth20);
        }
    }
    //Clean the link
    location.hash = "";
    //Check for saved data
    try {
        coursesData = JSON.parse(localStorage.getItem("coursesData"));
        assignments = JSON.parse(localStorage.getItem("assignments"));
        submissions = JSON.parse(localStorage.getItem("submissions"));
    } catch (e) {
        coursesData = null
        assignments = null
        submissions = null
    }

    if (coursesData === null || assignments === null || submissions === null) {
        spinner.style.animation = "spin 1.5s linear infinite"
        calendar()
        colorChange()
        update()
    } else {
        addFilters()
        createObj()
        document.querySelector('.loader').remove()
        calendar()
        colorChange()
        filter()
        update()
    }
}

function update() {
    if (!ongoing) {

        ongoing = true
        spinner.style.animation = "spin 1.5s linear infinite"
        assList.style.textAlign = "left"

        coursesData = [];
        assignments = [];
        submissions = [];
        courseFetch().then(assigmentFetch).then(statusFetch).then(() => {
            addFilters()
            timedAssignments = [];
            createObj()
            try {
                document.querySelector('.loader').remove()
            } catch (e) {
            }
            spinner.style.animation = "return 1s";
            //Update calendar
            calendar()
            colorChange()
            filter()
            ongoing = false
        })
    }
}

//Fetchy-----------------------------------------------------------
async function courseFetch() {
    //Preparing header
    header.append('Authorization', `Bearer ${token}`);

    //And here begins the "fun"
    try {
        //Waits for fetch to return a response
        const response = await fetch('https://classroom.googleapis.com/v1/courses', {
            method: 'GET',
            headers: header
        });
        //Take out the courses array from json
        coursesData = await response.json();
        const {courses} = coursesData
        coursesData = courses
        localStorage.setItem("coursesData", JSON.stringify(coursesData));
    } catch (error) {
        console.error(error);
    }
}

async function assigmentFetch() {
    //Preparing to batch request
    let Batch = []

    try {
        //1 request for every course
        coursesData.forEach((course) => {

            //Push the promise into the array
            Batch.push(fetch(`https://classroom.googleapis.com/v1/courses/${course['id']}/courseWork`, {
                method: 'GET',
                headers: header
            }).then((res) => res.json()))
        })
    } catch
        (e) {
        console.log(e)
    }
    //Save all the Batch requested data (minutes of wait time saved, yay)
    assignments = await Promise.all(Batch);

    //Check if the course has no data and remove from array
    let length = assignments.length-1
    assignments.slice().reverse().forEach((ass, index) => {
        if (Object.keys(ass).length === 0) {
           assignments.splice(length-index, 1)
                  }
    })

    localStorage.setItem("assignments", JSON.stringify(assignments));
}

async function statusFetch() {
    //1 fetch, 16 fetch, Nah that for scrubs, how about hundreds?
    let batch = [];

    try {
        //For every course
        assignments.forEach((courseWorks) => {
            //Take out the array
            const {courseWork} = courseWorks;
            //For every assigment in array
            courseWork.forEach((workData) => {
                //If assignment has a deadline
                if (workData['dueDate'] !== undefined) {
                    //Save promise in array
                    batch.push(fetch(`https://classroom.googleapis.com/v1/courses/${workData['courseId']}/courseWork/${workData['id']}/studentSubmissions`, {
                        method: 'GET',
                        headers: header
                    }).then((res) => res.json()))
                }
            })
        })
    } catch
        (e) {
        console.log(e)
    }

    submissions = await Promise.all(batch);
    let length = submissions.length-1
    submissions.slice().reverse().forEach((ass, index) => {
        if (Object.keys(ass).length === 0) {
            submissions.splice(length-index, 1)
        }
    })
    localStorage.setItem("submissions", JSON.stringify(submissions));
}

function createObj() {
    let lateTemp;
    //"Assembly" or object creation
    try {
        //Submission contains only those assignments which have a deadline, those are the only ones I want to create
        //So for every submission
        submissions.forEach((sub) => {
            //Take out the item
            //      try {
            sub = sub['studentSubmissions'][0]
            //}catch (e){}
            //Then loop through assignments (who have different data)
            assignments.forEach((course) => {
                //Take out array per course
                const {courseWork} = course
                //Loop through the array
                courseWork.every((ass) => {
                    //Until you find data with the same ID
                    if (ass['id'] === sub['courseWorkId']) {
                        lateTemp = (sub['late'] === undefined) ? false : sub['late'];
                        //Creat object and add to array
                        timedAssignments.push(
                            {
                                Title: ass['title'],
                                Link: ass['alternateLink'],
                                CourseID: ass['courseId'],
                                DueDate: ass['dueDate'],
                                DueTime: ass['dueTime'],
                                AssigmentID: ass['id'],
                                Late: lateTemp,
                                State: sub['state']
                            })
                        //Break out
                        return false
                    }
                    //Repeat
                    return true
                })
            })
        })
    } catch
        (e) {
        console.log(e)
    }
}

//Calendar-------------------------------------------------------------------------------------

const date = new Date();
//Show current date under assignments
document.querySelector('#date').innerHTML = date.toDateString()

//Header of calendar
const calendarMonth = document.querySelector(".date h1");
const calendarFullDate = document.querySelector(".date p");

//Calendar days div
const calendarDays = document.querySelector('.days');

//Events-----------------------------------------------------------
document.querySelector(".prev")
    .addEventListener("click", () => {
        date.setMonth(date.getMonth() - 1)
        if (date.getMonth() !== new Date().getMonth()) {
            date.setDate(1)
        } else {
            todayChecker()
        }
        calendar()
        colorChange()
    })
document.querySelector(".next")
    .addEventListener("click", () => {
        date.setMonth(date.getMonth() + 1)
        if (date.getMonth() !== new Date().getMonth()) {
            date.setDate(1)
        } else {
            todayChecker()
        }
        calendar()
        colorChange()
    })
document.querySelector('.days').addEventListener("mouseover", (e) => {
    e = e.target
    if (!e.classList.contains('days') && !e.classList.contains('assCounter')) {
        let month = 0
        let year = 0
        if (e.classList.contains('prevDate')) {
            month = -1
        } else if (e.classList.contains('nextDate')) {
            month = 1
            if (date.getMonth() === 0) {
                year = 1
            }
        }
        let temp = new Date(date.getFullYear() + year, date.getMonth() + month, date.getDate())
        temp.setDate(parseInt(e.innerHTML))
        document.querySelector(".date p").innerHTML = temp.toDateString()
        //-----------------------
        e.addEventListener("mouseleave", () => {
            document.querySelector(".date p").innerHTML = date.toDateString();
        })
    }
})
document.querySelector('.days').addEventListener("click", (e) => {
    if (!e.target.classList.contains('days') && !e.target.classList.contains('assCounter')) {
        calendarDayFilter()
    }
})

//-----------------------------------------------------------------


function calendar() {
    let days = "";
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    //This month's last date
    const monthLDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    //Last month's last date
    const lMonthLDay = new Date(date.getFullYear(), date.getMonth(), 0);

    //Last month FIRST date visible on calendar (26...,30, 1, 2, 3; 26 is first visible)
    const firstDate = (lMonthLDay.getDate() - (lMonthLDay.getDay() - 1));

    //Last date visible on calendar
    let nextDate = 7 - monthLDay.getDay();
    let counter;

    //Header
    calendarMonth.innerHTML = months[date.getMonth()]
    calendarFullDate.innerHTML = date.toDateString()

    //For first visible date to last date of previous month
    for (let k = firstDate; k <= lMonthLDay.getDate(); k++) {

        counter = assignmentCounter(new Date(date.getFullYear(), date.getMonth() - 1, k))
        //Keep saving in a variable
        days += `<div class="prevDate">${k}<div class="assCounter">${counter}</div></div>`;
    }

    //Dates of this month
    for (let i = 1; i <= monthLDay.getDate(); i++) {
        counter = assignmentCounter(new Date(date.getFullYear(), date.getMonth(), i));

        //If date on calendar matched today's date
        if (i === date.getDate() && date.getMonth() === new Date().getMonth() && new Date().getFullYear() === date.getFullYear()) {
            //Give class "today"
            days += `<div class="today">${i}<div class="assCounter">${counter}</div></div>`;
            //If only date and month match
        } else if (i === date.getDate() && date.getMonth() === new Date().getMonth()) {
            //Give class "other today"
            days += `<div class="otherToday">${i}<div class="assCounter">${counter}</div></div>`;
        } else {
            //Give class "normal day"
            days += `<div class="nDay">${i}<div class="assCounter">${counter}</div></div>`;
        }
    }

    //Checks if requires an extra row of calendar days
    nextDate += (lMonthLDay.getDay() + monthLDay.getDate() < 35) ? 7 : 0;

    //Dates of next month
    for (let j = 1; j <= nextDate; j++) {
        counter = assignmentCounter(new Date(date.getFullYear(), date.getMonth() + 1, j));
        days += `<div class="nextDate">${j}<div class="assCounter">${counter}</div></div>`;
    }
    //Push variable to html
    calendarDays.innerHTML = days;
    //  colorChange();
}

function assignmentCounter(dateZ) {
    let counter = 0;
    timedAssignments.forEach((ass) => {
        const {DueDate} = ass;
        if (DueDate['year'] === dateZ.getFullYear() && DueDate['month'] === (dateZ.getMonth() + 1) && DueDate['day'] === dateZ.getDate()) {
            counter++;
        }
    })
    if (counter !== 0) {
        return counter
    } else {
        return "";
    }
}

function colorChange() {
    //All calendar days divs
    const daysBorder = document.querySelectorAll(".days div:not(.assCounter)")
    const element = [
        document.querySelector(".header h1"),
        document.querySelector(".header p"),
        document.querySelector(".date"),
        document.querySelector(".next"),
        document.querySelector(".prev")]

    //Gives them different classes depending on month, changes appearance
    switch (date.getMonth()) {
        case 11:
        case 0:
        case 1:
            for (let i = 0; i < element.length; i++) {
                element[i].classList.add("winter");
                element[i].classList.remove("autumn");
                element[i].classList.remove("spring");
                element[i].classList.remove("summer");
            }
            daysBorder.forEach((div) => {
                div.style.borderImage = "linear-gradient(to bottom,#0339fa, #03fafa, #0339fa,#1e1e1d 98%) 1";
            })
            break;
        case 2:
        case 3:
        case 4:
            for (let i = 0; i < element.length; i++) {
                element[i].classList.add("spring");
                element[i].classList.remove("autumn");
                element[i].classList.remove("summer");
                element[i].classList.remove("winter");
            }
            daysBorder.forEach((div) => {
                div.style.borderImage = "linear-gradient(to bottom,#ff9900, #ffe400, #FF9900FF,#1e1e1d 98%) 1";
            })
            break;
        case 5:
        case 6:
        case 7:
            for (let i = 0; i < element.length; i++) {
                element[i].classList.add("summer");
                element[i].classList.remove("spring");
                element[i].classList.remove("autumn");
                element[i].classList.remove("winter");
            }
            daysBorder.forEach((div) => {
                div.style.borderImage = "linear-gradient(to bottom,#095038, #03fa66, #095038,#1e1e1d 98%) 1";
            })
            break;
        case 8:
        case 9:
        case 10:
            for (let i = 0; i < element.length; i++) {
                element[i].classList.add("autumn");
                element[i].classList.remove("spring");
                element[i].classList.remove("winter");
                element[i].classList.remove("summer");
            }
            daysBorder.forEach((div) => {
                div.style.borderImage = "linear-gradient(to bottom,#ff2600, #ffa12f 20%, #ff2600 80%,#1e1e1d 98%) 1";
            })
            break;
    }
    //Hides the green circle of counter if the div is empty
    daysBorder.forEach((div) => {
        div = div.children[0]
        if (div.innerHTML === "") {
            div.style.background = "rgba(0,0,0,0)";
        }
    })
}

function calendarDayFilter() {
    let temp = "";
    let dateF = new Date(calendarFullDate.innerHTML)
    removeEmpty()
    document.querySelector('.list').scrollIntoView()

    timedAssignments.forEach((ass) => {
        const {DueDate} = ass
        if (DueDate['year'] === dateF.getFullYear() &&
            DueDate['month'] === (dateF.getMonth() + 1) &&
            DueDate['day'] === dateF.getDate()) {
            temp += `<li class="assigment">${ass['Title']}</li>`
        }
    })
    assList.innerHTML = temp;
    addEmpty()
    counter.innerHTML = "Total: " + assList.childElementCount;
}

function todayChecker() {
    if (date.getMonth() === new Date().getMonth()) {
        date.setDate(new Date().getDate())
    }
}

//Assignments---------------------------------------------------------------------------
const counter = document.querySelector('.list .header div #counter')
counter.innerHTML = "Total: "

const select = document.querySelector('select')
const assList = document.querySelector('#assigmentList');
const container = document.querySelector('.assContainer ');

//Events-----------------------------------------------------------
document.querySelector('#assigmentList').addEventListener('dblclick', (e) => {
    window.getSelection().removeAllRanges();
    if (e.target.classList.contains('assigmentDetails')) {
        e = e.target
        //Loopar tills den får rätt parent
        while (e.id !== 'assigmentDetails') {
            e = e.parentElement
        }
        e = e.parentElement
    } else {
        e = e.target
    }
    //Om man vill öppna
    if ((e.style.height === "" || e.style.height === "4rem") && e.id.indexOf('assigmentList') < 0) {
        let subject;
        timedAssignments.every((ass) => {
            if (e.innerHTML.replace(/&amp;/g, '&') === ass['Title']) {
                coursesData.every((course) => {
                    if (course['id'] === ass['CourseID']) {
                        subject = course['name']
                        return false
                    }
                    return true
                })
                info(e, ass, subject)
                return false
            }
            return true
        })
        e.style.height = "auto"
        e.style.textAlign = "center"
        //Om man vill stänga
    } else {
        let details = e.childNodes[1]
        if (details !== null) {
            details.remove()
        }
        e.style.textAlign = "left"
        e.style.height = "4rem"
    }
})

//-----------------------------------------------------------------

function Size() {
    select.style.overflow = "scrollbar"
    let count = (select.childElementCount < 10) ? select.childElementCount - 1 : 10
    select.setAttribute("size", `${count}`)
}

function addFilters() {
    let temp = ""

    temp += '<optgroup label="Classes"></optgroup>"';
    temp += '<option value="" hidden >Filters</option>';
    temp += '<option value="" >All</option>';

    coursesData.forEach((course) => {
        //Saving ID so that it is easier to filter later
        temp += `<option value ="${course['id']}">${course['name']}</option>`
    })
    select.innerHTML = temp;
}

function filter() {
    const courseID = document.querySelector(".inputContainer select").value;
    let filterTemp = ""

    //Clean list
    assList.innerHTML = "";
    removeEmpty()
    //Search for objects with same course ID
    timedAssignments.forEach((ass) => {
        if (courseID === ass['CourseID']) {
            filterTemp += `<li class="assigment">${ass['Title']}</li>`
        }
    })
    assList.innerHTML = filterTemp;

    if (courseID === "") {
        displayAllAssignments();
    }
    addEmpty()
    counter.innerHTML = "Total: " + assList.childElementCount;
}

function displayAllAssignments() {
    let temp = ""

    removeEmpty()
    timedAssignments.forEach((ass) => {
        temp += `<li class="assigment">${ass['Title']}</li>`
    })
    assList.innerHTML = temp;
    addEmpty()

    counter.innerHTML = "Total: " + assList.childElementCount
}

function search() {
    select.blur()
    filter()
    removeEmpty()
    const magnifyingGlas = document.querySelector('label i')
    magnifyingGlas.style.visibility = "hidden";

    const title = document.querySelectorAll('#assigmentList li')
    const value = document.querySelector('#inputField')
    let temp = "";

    title.forEach((item) => {
        if (item.innerHTML.toLowerCase().indexOf(value.value.toLowerCase()) > -1) {
            timedAssignments.every((ass) => {
                if (ass['Title'] === item.innerHTML) {
                    temp += `<li class="assigment">${ass['Title']}</li>`
                    return false
                }
                return true
            })
        }
    })
    assList.innerHTML = temp;
    counter.innerHTML = "Total: " + assList.childElementCount;

    addEmpty()
    if (value.value === "") {
        magnifyingGlas.style.visibility = "visible";
        filter()
    }
}

function removeEmpty() {
    const empty = document.querySelector('.empty');
    if (empty !== null) {
        container.removeChild(empty);
    }
}

function addEmpty() {
    if (assList.childElementCount === 0 && document.querySelector('.empty') === null) {
        let element = document.createElement('p')
        element.setAttribute("class", "empty")
        element.appendChild(document.createTextNode("Empty"))
        container.appendChild(element);
        assList.innerHTML = "";
    }
}

function info(e, ass, subject) {

    //För att den ska få rätt parent så satte jag samma class på alla, kom inte på ett bättre sätt
    e.innerHTML = `${ass['Title']}<div id="assigmentDetails" class="assigmentDetails">
                <p class="assigmentDetails">Details</p>
                <div class="assigmentDetails">
                    <div class="assigmentDetails"><p class="assigmentDetails">Subject:</p> 
                    <p1 class="assigmentDetails">${subject}</p1></div>
                    <div class="assigmentDetails"><p class="assigmentDetails">Deadline:</p> 
                    <p1 class="assigmentDetails">${ass['DueDate']['day']}/${ass['DueDate']['month']}/${ass['DueDate']['year']}</p1></div>
               </div>
               <div class="assigmentDetails">
                    <div class="assigmentDetails"><p class="assigmentDetails">ID:</p> 
                    <p1 class="assigmentDetails">${ass['AssigmentID']}</p1></div>
                    <div class="assigmentDetails"><p class="assigmentDetails">Due time:</p>
                     <p1 class="assigmentDetails">${ass['DueTime']['hours']}:${ass['DueTime']['minutes']}</p1></div>
               </div>                  
               <div class="assigmentDetails">
                    <div class="assigmentDetails"><p class="assigmentDetails">Late:</p> 
                    <p1 class="assigmentDetails">${ass['Late']}</p1></div>
                    <div class="assigmentDetails"><p class="assigmentDetails">State:</p> 
                    <p1 class="assigmentDetails">${ass['State']}</p1></div>
               </div>
                    <a class="assigmentDetails" target="_blank" href="${ass['Link']}">To Assigment</a> 
            </div>`
}

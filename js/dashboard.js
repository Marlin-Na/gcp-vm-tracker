
const GAPI_CONFIG = {
    // Enter an API key from the Google API Console:
    //   https://console.developers.google.com/apis/credentials
    apiKey: 'AIzaSyDHYN7i6wxS3_KP568OejzlvFUpz9X4h-M',
    // Enter the API Discovery Docs that describes the APIs you want to
    // access. In this example, we are accessing the People API, so we load
    // Discovery Doc found here: https://developers.google.com/people/api/rest/
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/compute/v1/rest", "https://cloudresourcemanager.googleapis.com/$discovery/rest?version=v1"],
    // Enter a client ID for a web application from the Google API Console:
    //   https://console.developers.google.com/apis/credentials?project=_
    // In your API Console project, add a JavaScript origin that corresponds
    //   to the domain where you will be running the script.
    clientId: '460143007298-jibfq6a7rp52pidastmjr5c2m2l2ik4m.apps.googleusercontent.com',
    // Enter one or more authorization scopes. Refer to the documentation for
    // the API or https://developers.google.com/people/v1/how-tos/authorizing
    // for details.
    scope: "https://www.googleapis.com/auth/compute https://www.googleapis.com/auth/cloud-platform"
}

const DOM_IDS = {
    authorizeButton: 'authorize-button',
    signoutButton: 'signout-button',
    updateButton: 'update-button'
}

///// DOM Handlers  //////////////////////////////

function handle_authorizeButton(event) {
    gapi.auth2.getAuthInstance().signIn();
}

function handle_signoutButton(event) {
    gapi.auth2.getAuthInstance().signOut();
}

function handle_updateButton(event) {
    update_table();
}

function update_signinStatus() {
    let isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
    let doms = {}
    for (let [name, id] of Object.entries(DOM_IDS))
        doms[name] = document.getElementById(id);
    if (isSignedIn) {
        doms.authorizeButton.style.display = 'none';
        doms.signoutButton.style.display = 'block';
        doms.updateButton.style.display = 'block';
    } else {
        doms.authorizeButton.style.display = 'block';
        doms.signoutButton.style.display = 'none';
        doms.updateButton.style.display = 'none';
    }
}

function update_table() {
    let isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
    if (isSignedIn) {
        makeApiCall();
    } else {
        alert("Please signin with your Google Account first.");
    }
}

///// This is the main entry point  //////////////

window.onload = function() {
    // Load the API client and auth2 library
    gapi.load('client:auth2', function() {
        gapi.client.init(GAPI_CONFIG)
            .then(set_signin)
            .then(add_dom_handlers);
    });
    function set_signin() {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(update_signinStatus);
        // Handle the initial sign-in state.
        update_signinStatus();
    }
    function add_dom_handlers() {
        let doms = {}
        for (let [name, id] of Object.entries(DOM_IDS))
            doms[name] = document.getElementById(id);
        doms.authorizeButton.onclick = handle_authorizeButton;
        doms.signoutButton.onclick = handle_signoutButton;
        doms.updateButton.onclick = handle_updateButton;
    }
}

class ComputeDataHandler {
    constructor() {
        this.all_projects = [];
        this.all_instances = [];
        this.tick = 0;
    }
    async update_projects() {
        let gapi_projects;
        gapi_projects = await gapi.client.cloudresourcemanager.projects.list();
        gapi_projects = gapi_projects.result.projects;
        window.projects = gapi_projects;
        gapi_projects = gapi_projects.map(d => d.projectId);
        this.all_projects = gapi_projects;
    }
    async update_instances() {
        let _this = this;
        this.tick = 0;
        this.tick = this.tick + 1;
        await this.update_projects();
        this.tick = this.tick + 1;
        // reset this.all_instances
        this.all_instances.length = 0;

        const process_response = function(response) {
            if (!response.result.items)
                return;
            for (let [zone_key, zone] of Object.entries(response.result.items)) {
                if (zone.instances) {
                    for (let instance of zone.instances) {
                        _this.all_instances.push(instance);
                    }
                }
            }
        };

        const fetch_project = async function(project) {
            let request_params = {project: project}
            try {
                let response = await gapi.client.compute.instances.aggregatedList(request_params).getPromise();
                _this.tick = _this.tick + 1;
                process_response(response);
                while (response.nextPageToken) {
                    request_params.pageToken = response.nextPageToken;
                    response = await gapi.client.compute.instaces.aggregatedList(request_params).getPromise();
                    _this.tick = _this.tick + 1;
                    process_response(response);
                }
            } catch (error) {
                console.error("Error when fetching instances", error);
            }
        };

        // Fire all request concurrently
        await Promise.all(this.all_projects.slice().reverse().map(fetch_project));
        this.tick = 0;
    }
}

let all_projects = [];
let all_instances = [];

function makeApiCall() {
    let data = new ComputeDataHandler();
    window.data = data;
    data.update_instances().then(res => {
        console.log(data.all_instances);
    });
    //gapi.client.compute.instances.list({ project: "broad-getzlab-gdan", zone: "us-east1-d" })
    //    .then(res => console.log(res))
}

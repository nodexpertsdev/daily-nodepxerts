'use strict';

const helpers = require('./helpers');
const messages = require('./messages');
const alexaLogger = require('./logger');

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome to NodeXperts!';
    const speechOutput = messages.greetingMessage;
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const repromptText = messages.repromptMessage;
    const shouldEndSession = false;

    callback(sessionAttributes,
        helpers.buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}
    
function handleSessionEndRequest(callback) {
    const cardTitle = 'What\'s new on NodeXperts Skill Exited';
    const speechOutput = messages.goodByeMessgae;
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;

    callback({}, helpers.buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function handleSessionHelpRequest(callback) {
    const cardTitle = 'Asking for help to What\'s new on NodeXperts!';
    const speechOutput = messages.helpMessage;
    const repromptText = messages.repromptMessage;
    const shouldEndSession = false;

    callback(sessionAttributes,
        helpers.buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

/**
 * Sets the color in the session and prepares the speech to reply to the user.
 */
function getLatestNewsByNodeXperts(intent, session, callback) {
    if (intent.name === 'AMAZON.HelpIntent') {
        return handleSessionHelpRequest(callback);
    } else if (intent.name === 'AMAZON.StopIntent' || intent.name === 'AMAZON.CancelIntent') {
        return handleSessionEndRequest(callback);
    }
    const query = getQueryByIntent(intent.name);
    const cardTitle = intent.name;
    alexaLogger.logInfo(`Intent ${cardTitle} received`);
    const repromptText = messages.repromptMessage;
    let sessionAttributes = {};
    const shouldEndSession = false;
    dynamodb.getItem(query, (err, data) => {
        let speechOutput;
        if (err) {
            alexaLogger.logError(`Error in getting data from dynamodb: ${err}`);
            speechOutput = 'We\'re sorry, there was some issue in getting response. Please try again.'
        } else {
            speechOutput = data.Item.answer['S'];
            alexaLogger.logInfo(`Recieved data from table for sessionId=${session.sessionId}: ${speechOutput}`);
        }
        callback(sessionAttributes,
            helpers.buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    });
}


// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    alexaLogger.logInfo(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    alexaLogger.logInfo(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    alexaLogger.logInfo(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;
    getLatestNewsByNodeXperts(intent, session, callback);
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    alexaLogger.logInfo(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
    handleSessionEndRequest(callback);
}


// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
    try {
        context.callbackWaitsForEmptyEventLoop = false;
        alexaLogger
            .init()
            .then(() => {
                alexaLogger.logInfo(`event.session.application.applicationId=${event.session.application.applicationId}`);
                if (event.session.new) {
                    onSessionStarted({ requestId: event.request.requestId }, event.session);
                }

                if (event.request.type === 'LaunchRequest') {
                    onLaunch(event.request,
                        event.session,
                        (sessionAttributes, speechletResponse) => {
                            callback(null, helpers.buildResponse(sessionAttributes, speechletResponse));
                        });
                } else if (event.request.type === 'IntentRequest') {
                    onIntent(event.request,
                        event.session,
                        (sessionAttributes, speechletResponse) => {
                            callback(null, helpers.buildResponse(sessionAttributes, speechletResponse));
                        });
                } else if (event.request.type === 'SessionEndedRequest') {
                    onSessionEnded(event.request, event.session);
                    callback();
                }
            })
            .catch((err) => {
                alexaLogger.logError(`Error in handling request: ${err}`);
                return callback(err);
            });
    } catch (err) {
        alexaLogger.logError(`Error in try-catch: ${err}`);
        return callback(err);
    }
};

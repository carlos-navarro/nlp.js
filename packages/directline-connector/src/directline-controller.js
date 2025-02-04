/*
 * Copyright (c) AXA Group Operations Spain S.A.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const { uuid } = require('@nlpjs/core');
const fetch = require('isomorphic-fetch');

class DirectlineController {
  constructor(settings) {
    const localhost = 'http://localhost:3000';
    this.settings = settings;
    this.serviceUrl =
      this.settings.serviceUrl ||
      process.env.DIRECTLINE_SERVICE_URL ||
      localhost;
    // this.botUrl = this.settings.botUrl || process.env.DIRECTLINE_BOT_URL || `http://localhost:4000/api/messages`;
    this.botUrl = this.settings.botUrl || process.env.DIRECTLINE_BOT_URL;
    this.expiresIn = this.settings.expiresIn || 1800;
    this.conversations = {};
  }

  getConversation(id, autocreate = false) {
    const conversationId = id || uuid();
    if (!this.conversations[conversationId] && autocreate) {
      this.conversations[conversationId] = {
        conversationId,
        history: [],
      };
    }
    return this.conversations[conversationId];
  }

  createActivity(incoming, conversationId) {
    return {
      ...incoming,
      channelId: 'emulator',
      serviceUrl: this.serviceUrl,
      conversation: {
        id: conversationId,
      },
      address: {
        conversation: {
          id: conversationId,
        },
      },
      id: uuid(),
    };
  }

  createConversationUpdateActivity(conversation) {
    return this.createActivity(
      {
        type: 'conversationUpdate',
        membersAdded: [],
        membersRemoved: [],
        from: {
          id: process.env.BACKEND_ID || 'directline',
          name: process.env.BACKEND_NAME || 'Directline',
        },
      },
      conversation.id
    );
  }

  createConversation() {
    return new Promise(resolve => {
      const conversation = this.getConversation(undefined, true);
      const activity = this.createConversationUpdateActivity(conversation);
      if (this.botUrl) {
        fetch(this.botUrl, {
          method: 'POST',
          body: JSON.stringify(activity),
          headers: {
            'Content-Type': 'application/json',
          },
        }).then(response => {
          resolve({
            status: response.status,
            body: {
              conversationId: conversation.conversationId,
              expiresIn: this.expiresIn,
            },
          });
        });
      } else {
        resolve({
          status: 200,
          body: {
            conversationId: conversation.conversationId,
            expiresIn: this.expiresIn,
          },
        });
      }
    });
  }

  addActivity(conversationId, srcActivity) {
    return new Promise(resolve => {
      if (srcActivity.type !== 'typing') {
        const activity = this.createActivity(srcActivity, conversationId);
        const conversation = this.getConversation(conversationId, true);
        conversation.history.push(activity);
        if (this.botUrl) {
          fetch(this.botUrl, {
            method: 'POST',
            body: JSON.stringify(activity),
            headers: {
              'Content-Type': 'application/json',
            },
          }).then(response => {
            resolve({
              status: response.status,
              body: {
                id: activity.id,
                timestamp: new Date().toUTCString(),
              },
            });
          });
        } else {
          const result = {
            type: 'message',
            serviceUrl: activity.serviceUrl,
            channelId: activity.channelId,
            conversation: {
              id: activity.conversation.id,
            },
            text: activity.text,
            recipient: activity.from,
            inputHint: 'acceptingInput',
            replyToId: activity.id,
            id: uuid(),
            from: {
              id: process.env.BACKEND_ID || 'directline',
              name: process.env.BACKEND_NAME || 'Directline',
            },
          };
          const nlp = this.settings.container.get('nlp');
          if (nlp) {
            nlp.process(activity.text).then(nlpresult => {
              result.text =
                nlpresult.answer || "Sorry, I didn't understand you";
              conversation.history.push(result);
              resolve({
                status: 200,
                body: { id: result.id, timestamp: new Date().toUTCString() },
              });
            });
          } else {
            conversation.history.push(result);
            resolve({
              status: 200,
              body: { id: result.id, timestamp: new Date().toUTCString() },
            });
          }
        }
      } else {
        resolve({ status: 200, body: {} });
      }
    });
  }

  getActivities(conversationId, watermark) {
    return new Promise(resolve => {
      const conversation = this.getConversation(conversationId, true);
      const activities =
        conversation.history.length > watermark
          ? conversation.history.slice(watermark)
          : [];
      resolve({
        status: 200,
        body: {
          activities,
          watermark: watermark + activities.length,
        },
      });
    });
  }

  postActivityV3(conversationId, srcActivity) {
    return new Promise(resolve => {
      const activity = srcActivity;
      activity.id = uuid();
      activity.from = {
        id: process.env.BACKEND_ID || 'directline',
        name: process.env.BACKEND_NAME || 'Directline',
      };
      const conversation = this.getConversation(conversationId, true);
      conversation.history.push(activity);
      resolve({
        status: 200,
      });
    });
  }
}

module.exports = DirectlineController;

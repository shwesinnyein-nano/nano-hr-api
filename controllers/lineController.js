
const { admin, db } = require("../config/firebaseConfig")
const axios = require('axios');
const lineConfig = require('../config/lineConfig');

const querystring = require('querystring');


const CHANNEL_ACCESS_TOKEN = 'RSLblUCo+9KGnElBgVQIentYDKv0TEbQvlDyZYDfvqSxReizAhCGtQTkK23YTtTArQSqYH9r+/W4lKStPxmZbMuKUv6jzjArZbTAvoVjfPD/K32QCCI80aejeGIycf55A5HA1pg5X2CuS7X95nWGJQdB04t89/1O/w1cDnyilFU='

exports.lineLoginCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Authorization code is missing" });
    }

    // Exchange Code for Access Token
    const tokenResponse = await axios.post(
      "https://api.line.me/oauth2/v2.1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "http://localhost:4200/employee-info/employee-profile-info",
        client_id: "2006952876",
        client_secret: "764faa47b3668720cd8c096bafdeb099",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch User Profile
    const profileResponse = await axios.get("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userId = profileResponse.data.userId;
    const displayName = profileResponse.data.displayName;
    const pictureUrl = profileResponse.data.pictureUrl;
    console.log("userid", userId)
    // res.redirect(`http://localhost:4200/employee_profile_info?userId=${userId}&displayName=${encodeURIComponent(displayName)}&pictureUrl=${encodeURIComponent(pictureUrl)}`);
    res.json({ userId, displayName, pictureUrl }); // Send user info to frontend
  } catch (error) {
    console.error("LINE Login Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to login with LINE" });
  }
};


exports.sendLineNotification1 = async (req, res) => {
  try {
    const { lineId, message } = req.body;

    if (!lineId || !message || !websiteUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Construct the Flex Message payload
    // const flexMessage = {
    //   {
    //     "type": "bubble",
    //     "body": {
    //       "type": "box",
    //       "layout": "vertical",
    //       "contents": [
    //         {
    //           "type": "text",
    //           "text": "Nano VIP",
    //           "weight": "bold",
    //           "size": "xl"
    //         },
    //         {
    //           "type": "box",
    //           "layout": "vertical",
    //           "margin": "lg",
    //           "spacing": "sm",
    //           "contents": [
    //             {
    //               "type": "box",
    //               "layout": "baseline",
    //               "spacing": "sm",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Location",
    //                   "color": "#aaaaaa",
    //                   "size": "md",
    //                   "flex": 2
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "Phuket",
    //                   "wrap": true,
    //                   "color": "#666666",
    //                   "size": "sm",
    //                   "flex": 5
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "box",
    //               "layout": "baseline",
    //               "spacing": "sm",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Branch",
    //                   "color": "#aaaaaa",
    //                   "size": "sm",
    //                   "flex": 2
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "Chalong",
    //                   "wrap": true,
    //                   "color": "#666666",
    //                   "size": "sm",
    //                   "flex": 5
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "box",
    //               "layout": "baseline",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Date",
    //                   "flex": 2,
    //                   "size": "md",
    //                   "color": "#aaaaaa"
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "06 Dec 2025",
    //                   "flex": 5,
    //                   "size": "sm"
    //                 }
    //               ],
    //               "spacing": "sm"
    //             }
    //           ]
    //         },
    //         {
    //           "type": "box",
    //           "layout": "vertical",
    //           "contents": [
    //             {
    //               "type": "text",
    //               "text": "Test 8(EMP-05032025017)  need your approval for income transaction  INC-06032025023. Please review and verify it.",
    //               "size": "sm",
    //               "wrap": true,
    //               "margin": "lg"
    //             }
    //           ]
    //         }
    //       ]
    //     },
    //     "footer": {
    //       "type": "box",
    //       "layout": "vertical",
    //       "spacing": "sm",
    //       "contents": [
    //         {
    //           "type": "button",
    //           "style": "link",
    //           "height": "sm",
    //           "action": {
    //             "type": "uri",
    //             "label": "https://nanostores.co.th/",
    //             "uri": "https://nanostores.co.th/"
    //           }
    //         },
    //         {
    //           "type": "box",
    //           "layout": "vertical",
    //           "contents": [],
    //           "margin": "sm"
    //         }
    //       ],
    //       "flex": 0
    //     }
    //   }
    // };
    // const flex = {
    //   {
    //     "type": "bubble",
    //     "body": {
    //       "type": "box",
    //       "layout": "vertical",
    //       "contents": [
    //         {
    //           "type": "text",
    //           "text": "REQUEST",
    //           "weight": "bold",
    //           "color": "#1DB446",
    //           "size": "sm"
    //         },
    //         {
    //           "type": "text",
    //           "text": "Nano Stores",
    //           "weight": "bold",
    //           "size": "xxl",
    //           "margin": "md"
    //         },
    //         {
    //           "type": "text",
    //           "text": "Phuket, Chalong",
    //           "size": "xs",
    //           "color": "#aaaaaa",
    //           "wrap": true
    //         },
    //         {
    //           "type": "separator",
    //           "margin": "xxl"
    //         },
    //         {
    //           "type": "box",
    //           "layout": "vertical",
    //           "margin": "xxl",
    //           "spacing": "sm",
    //           "contents": [
    //             {
    //               "type": "box",
    //               "layout": "horizontal",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "size": "sm",
    //                   "color": "#555555",
    //                   "flex": 0,
    //                   "text": "Slip No"
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "INC-32423423",
    //                   "size": "sm",
    //                   "color": "#111111",
    //                   "align": "end"
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "box",
    //               "layout": "horizontal",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Date",
    //                   "size": "sm",
    //                   "color": "#555555",
    //                   "flex": 0
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "01/03/2025",
    //                   "size": "sm",
    //                   "color": "#111111",
    //                   "align": "end"
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "box",
    //               "layout": "horizontal",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Request By",
    //                   "size": "sm",
    //                   "color": "#555555",
    //                   "flex": 0
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "Lilly",
    //                   "size": "sm",
    //                   "color": "#111111",
    //                   "align": "end"
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "separator",
    //               "margin": "xxl"
    //             },
    //             {
    //               "type": "box",
    //               "layout": "horizontal",
    //               "margin": "xxl",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Income Type",
    //                   "size": "sm",
    //                   "color": "#555555"
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "Agency",
    //                   "size": "sm",
    //                   "color": "#111111",
    //                   "align": "end"
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "box",
    //               "layout": "horizontal",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Income Amount",
    //                   "size": "sm",
    //                   "color": "#555555"
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "100,000",
    //                   "size": "sm",
    //                   "color": "#111111",
    //                   "align": "end"
    //                 }
    //               ]
    //             },
    //             {
    //               "type": "box",
    //               "layout": "horizontal",
    //               "contents": [
    //                 {
    //                   "type": "text",
    //                   "text": "Paid By",
    //                   "size": "sm",
    //                   "color": "#555555"
    //                 },
    //                 {
    //                   "type": "text",
    //                   "text": "Cash",
    //                   "size": "sm",
    //                   "color": "#111111",
    //                   "align": "end"
    //                 }
    //               ]
    //             }
    //           ]
    //         },
    //         {
    //           "type": "separator",
    //           "margin": "xxl"
    //         },
    //         {
    //           "type": "box",
    //           "layout": "horizontal",
    //           "margin": "md",
    //           "contents": [
    //             {
    //               "type": "text",
    //               "size": "md",
    //               "color": "#aaaaaa",
    //               "flex": 0,
    //               "action": {
    //                 "type": "uri",
    //                 "label": "https://nanostores.co.th/login",
    //                 "uri": "http://linecorp.com/"
    //               },
    //               "text": "https://nanostores.co.th/login"
    //             }
    //           ]
    //         }
    //       ]
    //     },
    //     "styles": {
    //       "footer": {
    //         "separator": true
    //       }
    //     }
    //   }
    // }

    // Send the Flex Message via the LINE Messaging API
    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineId,
        messages: [flexMessage]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('LINE notification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send LINE notification' });
  }
};
exports.sendLineNotification2 = async (req, res) => {
  console.log("send ", req.body)
  try {
    const { lineId, message } = req.body; // Get data from frontend

    if (!lineId) {
      return res.status(400).json({ error: 'LINE ID is required' });
    }

    const flexMessage = {

      type: "bubble",
      direction: "ltr",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: message,
                align: "center",
                wrap: true
              }
            ],
            backgroundColor: "#80ffff"
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "TARGET"
              }
            ],
            backgroundColor: "#ff8080"
          }
        ]
      }

    }

    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineId,
        message: [flexMessage]
        //  messages: [{ type: 'text', text: message || 'New notification from the system.' }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('LINE notification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send LINE notification' });
  }
};

exports.sendLineNotification = async (req, res) => {
  console.log("send ", req.body);
  try {
    const { lineId, message } = req.body; // Get data from frontend

    if (!lineId) {
      return res.status(400).json({ error: 'LINE ID is required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const flexMessage1 = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "Nano VIP",
            weight: "bold",
            size: "xl"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Location",
                    color: "#aaaaaa",
                    size: "md",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: "Phuket",
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Branch",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 2
                  },
                  {
                    type: "text",
                    text: "Chalong",
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                contents: [
                  {
                    type: "text",
                    text: "Date",
                    flex: 2,
                    size: "md",
                    color: "#aaaaaa"
                  },
                  {
                    type: "text",
                    text: "06 Dec 2025",
                    flex: 5,
                    size: "sm"
                  }
                ],
                spacing: "sm"
              }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: message,
                size: "sm",
                wrap: true,
                margin: "lg"
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "Visit Website",
              uri: "https://nanostores.co.th/"
            }
          },
          {
            type: "box",
            layout: "vertical",
            contents: [],
            margin: "sm"
          }
        ],
        flex: 0
      }
    };
    const flex = {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "text",
            "text": "INCOME REQUEST",
            "weight": "bold",
            "color": "#1DB446",
            "size": "sm"
          },
          {
            "type": "text",
            "text": "Nano Stores",
            "weight": "bold",
            "size": "lg",
            "margin": "md"
          },
          {
            "type": "text",
            "text": "Phuket, Chalong",
            "size": "xs",
            "color": "#aaaaaa",
            "wrap": true
          },
          {
            "type": "separator",
            "margin": "lg"
          },
          {
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "sm",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "size": "sm",
                    "color": "#555555",
                    "flex": 0,
                    "text": "Slip No"
                  },
                  {
                    "type": "text",
                    "text": "INC-32423423",
                    "size": "sm",
                    "color": "#111111",
                    "align": "end"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "Date",
                    "size": "sm",
                    "color": "#555555",
                    "flex": 0
                  },
                  {
                    "type": "text",
                    "text": "01/03/2025",
                    "size": "sm",
                    "color": "#111111",
                    "align": "end"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "Request By",
                    "size": "sm",
                    "color": "#555555",
                    "flex": 0
                  },
                  {
                    "type": "text",
                    "text": "Lilly",
                    "size": "sm",
                    "color": "#111111",
                    "align": "end"
                  }
                ]
              },
              {
                "type": "separator",
                "margin": "xxl"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "margin": "xxl",
                "contents": [
                  {
                    "type": "text",
                    "text": "Income Type",
                    "size": "sm",
                    "color": "#555555"
                  },
                  {
                    "type": "text",
                    "text": "Agency",
                    "size": "sm",
                    "color": "#111111",
                    "align": "end"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "Income Amount",
                    "size": "sm",
                    "color": "#555555"
                  },
                  {
                    "type": "text",
                    "text": "100,000",
                    "size": "sm",
                    "color": "#111111",
                    "align": "end"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "Paid By",
                    "size": "sm",
                    "color": "#555555"
                  },
                  {
                    "type": "text",
                    "text": "Cash",
                    "size": "sm",
                    "color": "#111111",
                    "align": "end"
                  }
                ]
              }
            ]
          },
          {
            "type": "separator",
            "margin": "xxl"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "margin": "md",
            "contents": [
              {
                "type": "text",
                "size": "md",
                "color": "#aaaaaa",
                "flex": 0,
                "action": {
                  "type": "uri",
                  "label": "https://nanostores.co.th/login",
                  "uri": "http://linecorp.com/"
                },
                "text": "https://nanostores.co.th/login"
              }
            ]
          }
        ]
      },
      "styles": {
        "footer": {
          "separator": true
        }
      }
    };


    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineId,
        messages: [{ type: 'flex', altText: 'Income Request Notification', contents: flex }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('LINE notification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send LINE notification' });
  }
};

exports.sendLineNotificationExpense = async (req, res) => {
  console.log("send ", req.body);
  try {
    const { lineId, message } = req.body; // Get data from frontend

    if (!lineId) {
      return res.status(400).json({ error: 'LINE ID is required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    console.log("message", message.expense_slip_no)
    const flex = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "EXPENSE REQUEST",
            weight: "bold",
            color: "#1DB446",
            size: "sm"
          },
          {
            type: "text",
            text: message.companyName,
            weight: "bold",
            size: "lg",
            margin: "sm"
          },
          {
            type: "text",
            text: message.locationName,
            size: "xs",
            color: "#aaaaaa",
            wrap: true
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Slip No",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.expense_slip_no,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Date",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.expense_date,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Due Date",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.due_date,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Request By",
                    size: "xs",
                    color: "#555555",
                    flex: 0,
                    margin: "none"
                  },
                  {
                    type: "text",
                    text: message.createdByName,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ],
                spacing: "none"
              },
              {
                type: "separator"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    color: "#555555",
                    text: "Expense Type",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.expense_type,
                    size: "xs",
                    flex: 0
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Creditor Name",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.creditor_name,
                    flex: 0,
                    size: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Amount",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.expense_amount,
                    color: "#555555",
                    flex: 0,
                    size: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Status",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.status,
                    flex: 0,
                    size: "xs",
                    color: "#1DB446"
                  }
                ]
              }
            ]
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "none",
            contents: [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "Review",
                  uri: "https://nanostores.co.th/login"
                }
              }
            ]
          }
        ]
      },
      styles: {
        footer: {
          separator: true
        }
      }
    };

    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineId,
        messages: [{ type: 'flex', altText: 'Expense Request Notification', contents: flex }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('LINE notification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send LINE notification' });
  }
};


exports.sendLineNotificationIncome = async (req, res) => {
  console.log("send ", req.body);
  try {
    const { lineId, message } = req.body; // Get data from frontend

    if (!lineId) {
      return res.status(400).json({ error: 'LINE ID is required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    if (!message.incomeDate) {
      message.incomeDate = '-'
    }


    console.log("message", message.incomeSlipNo)
    const flex = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "INCOME REQUEST",
            weight: "bold",
            color: "#1DB446",
            size: "sm"
          },
          {
            type: "text",
            text: message.companyName,
            weight: "bold",
            size: "lg",
            margin: "sm"
          },
          {
            type: "text",
            text: message.locationName,
            size: "xs",
            color: "#aaaaaa",
            wrap: true
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Slip No",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.incomeSlipNo,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Income Date",
                    size: "xs",
                    color: "#555555",
                    flex: 0
                  },
                  {
                    type: "text",
                    text: message.incomeDate,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ]
              },

              {
                type: "box",
                layout: "horizontal",
                margin: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Request By",
                    size: "xs",
                    color: "#555555",
                    flex: 0,
                    margin: "none"
                  },
                  {
                    type: "text",
                    text: message.createdByName,
                    size: "xs",
                    color: "#111111",
                    align: "end"
                  }
                ],
                spacing: "none"
              },
              {
                type: "separator"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    color: "#555555",
                    text: "Income Type",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.incomeTypeName,
                    size: "xs",
                    flex: 0
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Debtor Name",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.debtorName,
                    flex: 0,
                    size: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Amount",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.incomeAmount,
                    color: "#555555",
                    flex: 0,
                    size: "xs"
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "text",
                    text: "Status",
                    color: "#555555",
                    size: "xs"
                  },
                  {
                    type: "text",
                    text: message.status,
                    flex: 0,
                    size: "xs",
                    color: "#1DB446"
                  }
                ]
              }
            ]
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            margin: "none",
            contents: [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "Review",
                  uri: "https://nanostores.co.th/login"
                }
              }
            ]
          }
        ]
      },
      styles: {
        footer: {
          separator: true
        }
      }
    };

    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineId,
        messages: [{ type: 'flex', altText: 'Income Request Notification', contents: flex }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        },
      }
    );

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('LINE notification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send LINE notification' });
  }
};

exports.sendMessage = async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: 'User ID and message are required.' });
  }
  const url1 = `https://api.line.me/v2/bot/profile/${userId}`;
  console.log("verify", url1)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,  // Use process.env to get the access token
  };


  try {
    const profileResponse = await axios.get(url1, { headers });
    console.log('User Profile:', profileResponse.data);  // Log the profile response
  } catch (error) {
    console.error('Error verifying user profile:', error.response ? error.response.data : error.message);
    return res.status(500).json({ error: 'Failed to verify user profile' });
  }
  
  console.log('Sending message to LINE user:', userId);  // Logging the user ID

  const url = 'https://api.line.me/v2/bot/message/push';
  

  const body = {
    to: userId,
    messages: [{
      type: 'text',
      text: message
    }]
  };

  // Log the request body for debugging
  console.log('Request Body:', body);

  try {
    const response = await axios.post(url, body, { headers });
    console.log('LINE API Response:', response.data);  // Log the successful response
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error sending message to LINE:', error.response ? error.response.data : error.message); // Detailed error logging
    return res.status(500).json({ error: error.message || 'Failed to send message to LINE' });
  }
};
exports.sendMessage1 = async (req, res) => {

  const { userId, message } = req.body;

  console.log("user id", userId)
  console.log("message", message)

  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
  };

  const body = {
    to: userId,
    messages: [{
      type: 'text',
      text: message
    }]
  };

  axios.post(url, body, { headers })
    .then(response => res.json(response.data))
    .catch(error => res.status(500).json({ error: error.message }));

};







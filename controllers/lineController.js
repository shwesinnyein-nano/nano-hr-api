
const { admin, db } = require("../config/firebaseConfig")
const axios = require('axios');
const lineConfig = require('../config/lineConfig');

const querystring = require('querystring');


const CHANNEL_ACCESS_TOKEN = '65ZvV/uf2j+pKODRkZDmHy1cAB7j+2sWenSff8NB9TarzyQXM3Oc1v9evdpmWMZT5THwCmqa0tIM5KFwxuqbgwrfz82uB6Y25QlCAAMOpDCOqN6eN7RFpLxa4hxN+EbrwlnJN42mOyUfyHFtA3Dj5AdB04t89/1O/w1cDnyilFU='

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
  
// exports.lineLoginCallback = async (req, res) => {
//     try {
//       const { code } = req.query;
//       if (!code) {
//         return res.status(400).json({ error: "Authorization code is missing" });
//       }
  
//       // Exchange Code for Access Token
//       const tokenResponse = await axios.post(
//         "https://api.line.me/oauth2/v2.1/token",
//         new URLSearchParams({
//           grant_type: "authorization_code",
//           code: code,
//           redirect_uri: "http://localhost:4200/employee-info/employee-profile-info",
//           client_id: "2006952876",
//           client_secret: "764faa47b3668720cd8c096bafdeb099",
//         }).toString(),
//         { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//       );
  
//       const accessToken = tokenResponse.data.access_token;
  
//       // Fetch User Profile
//       const profileResponse = await axios.get("https://api.line.me/v2/profile", {
//         headers: { Authorization: `Bearer ${accessToken}` },
//       });

//       const userId = profileResponse.data.userId;
//       const displayName = profileResponse.data.displayName;
//       const pictureUrl = profileResponse.data.pictureUrl;

//       // ✅ Redirect to the frontend without `code`
//       res.redirect(`http://localhost:4200/employee-info/employee-profile-info`);
      
//     } catch (error) {
//       console.error("LINE Login Error:", error.response?.data || error.message);
//       res.status(500).json({ error: "Failed to login with LINE" });
//     }
// };


// exports.lineLoginCallback = async (req, res) => {
//     try {
//         const { code } = req.query;
//         if (!code) {
//             return res.status(400).json({ error: "Authorization code is missing" });
//         }

//         // Exchange Code for Access Token
//         const tokenResponse = await axios.post(
//             "https://api.line.me/oauth2/v2.1/token",
//             new URLSearchParams({
//                 grant_type: "authorization_code",
//                 code: code,
//                 redirect_uri: "http://localhost:3000/line/lineLoginCallback",
//                 client_id: "2006952876",
//                 client_secret: "764faa47b3668720cd8c096bafdeb099",
//             }).toString(),
//             { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
//         );

//         const accessToken = tokenResponse.data.access_token;

//         // Fetch User Profile
//         const profileResponse = await axios.get("https://api.line.me/v2/profile", {
//             headers: { Authorization: `Bearer ${accessToken}` },
//         });

//         const userData = {
//             userId: profileResponse.data.userId,
//             displayName: profileResponse.data.displayName,
//             pictureUrl: profileResponse.data.pictureUrl,
//         };

//         // ✅ Send user data to the frontend and close the tab
//         res.send(`
//             <script>
//                 window.opener.postMessage(${JSON.stringify(userData)}, "http://localhost:4200");
//                 window.close();
//             </script>
//         `);

//     } catch (error) {
//         console.error("LINE Login Error:", error.response?.data || error.message);
//         res.status(500).send("Failed to login with LINE");
//     }
// };

exports.sendLineNotification = async (req, res) => {
    console.log("send ", req.body)
    try {
      const { lineId, message } = req.body; // Get data from frontend
  
      if (!lineId) {
        return res.status(400).json({ error: 'LINE ID is required' });
      }
  
      const response = await axios.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: lineId,
          messages: [{ type: 'text', text: message || 'New notification from the system.' }],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` ,
          },
        }
      );
  
      res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('LINE notification error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to send LINE notification' });
    }
  };
// exports.sendNotificationToEmployee = async (req, res) => {
//     console.log("line not", req.body)
//     const { employeeId, message } = req.body;

//     try {
//         // Retrieve employee data (Assuming you use MongoDB with Mongoose)
//         const employee = await Employee.findById(employeeId);
//         if (!employee || !employee.lineToken) {
//             return res.status(404).json({ message: 'Employee not found or LINE token missing' });
//         }

//         // Send notification
//         await sendLineNotification(employee.lineToken, message);
//         res.json({ success: true, message: 'Notification sent successfully!' });

//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ message: 'Internal Server Error' });
//     }
// };
async function sendLineNotification(lineToken, message) {
    try {
        const response = await axios.post(
            'https://notify-api.line.me/api/notify',
            new URLSearchParams({ message }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${lineToken}`,
                },
            }
        );
        console.log('Notification Sent:', response.data);
    } catch (error) {
        console.error('Error sending LINE notification:', error);
    }
}
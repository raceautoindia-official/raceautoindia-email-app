// import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
// import { convert } from "html-to-text";


// const sesClient = new SESClient({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// export async function sendBulkEmails(recipients, subject, message) {
//   const results = [];
//   let count = 0;

//   const plainTextMessage = convert(message, { wordwrap: 130 });

//   for (const recipient of recipients) {
//     count++;
//     console.log("Sending count:", count);

//     const params = {
//       Source: `"Race Auto India" <${process.env.SENDER_EMAIL}>`,
//       Destination: {
//         ToAddresses: [recipient],
//       },
//       Message: {
//         Subject: { Data: subject },
//         Body: {
//           Html: {
//             Data: message,
//             Charset: "UTF-8",
//           },
//           Text: {
//             Data: plainTextMessage,
//             Charset: "UTF-8",
//           },
//         },
//       },
//       ConfigurationSetName:'EmailTrackingSet',
//       ReplyToAddresses: [process.env.SENDER_EMAIL],
//       Headers: {
//         'List-Unsubscribe': `<mailto:info@raceautoindia.com>`,
//       },
//     };

//     try {
//       const command = new SendEmailCommand(params);
//       const result = await sesClient.send(command);
//       results.push({ success: result });
//     } catch (err) {
//       results.push({ error: err });
//     }
//   }

//   console.log("First result:", results[0]);
//   return results;
// }

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { convert } from "html-to-text";

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:   process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// helper to pause
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * recipients: string[]
 * subject: string
 * message: HTML string
 * options.rateLimit: emails per second (default 10)
 */
export async function sendBulkEmails(
  recipients,
  subject,
  message,
  { rateLimit = 10 } = {}
) {
  const results = [];
  const plainTextMessage = convert(message, { wordwrap: 130 });
  // how many ms to wait between each send
  const pauseMs = rateLimit > 0 ? 1000 / rateLimit : 0;

  let count = 0;
  for (const recipient of recipients) {
    count++;
    console.log(`Sending #${count} to ${recipient}`);

    const params = {
      Source: `"Race Auto India" <${process.env.SENDER_EMAIL}>`,
      Destination: { ToAddresses: [recipient] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: message, Charset: "UTF-8" },
          Text: { Data: plainTextMessage, Charset: "UTF-8" },
        },
      },
      ConfigurationSetName: "EmailTrackingSet",
      ReplyToAddresses: [process.env.SENDER_EMAIL],
      Headers: {
        "List-Unsubscribe": `<mailto:${process.env.SENDER_EMAIL}>`,
      },
    };

    try {
      const cmd = new SendEmailCommand(params);
      const res = await sesClient.send(cmd);
      results.push({ success: res });
    } catch (err) {
      results.push({ error: err });
    }

    // throttle
    if (pauseMs > 0 && count < recipients.length) {
      await delay(pauseMs);
    }
  }

  console.log("Done, first result:", results[0]);
  return results;
}

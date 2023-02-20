const nodeMailer = require('nodemailer')

exports.sendEmail = async (options) => {
  const transporter = nodeMailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: 'a6be3d971a3b8c',
      pass: '17ac9bed940724',
    },
  })

  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: options.email,
    subject: options.subject,
    text: options.message,
  }

  await transporter.sendMail(mailOptions)
}

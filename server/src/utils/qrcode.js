const QRCode = require('qrcode');

/**
 * Generate QR code for partner referral
 * @param {string} partnerUuid - Partner UUID for referral tracking
 * @returns {string} QR code data URL
 */
async function generatePartnerQRCode(partnerUuid) {
  try {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const referralUrl = `${clientUrl}/register?ref=${partnerUuid}`;
    
    const options = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
    
    const dataUrl = await QRCode.toDataURL(referralUrl, options);
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as PNG buffer
 * @param {string} partnerUuid - Partner UUID for referral tracking
 * @returns {Buffer} QR code PNG buffer
 */
async function generateQRCodeBuffer(partnerUuid) {
  try {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const referralUrl = `${clientUrl}/register?ref=${partnerUuid}`;
    
    const options = {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 300,
      margin: 2
    };
    
    const buffer = await QRCode.toBuffer(referralUrl, options);
    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code buffer');
  }
}

module.exports = {
  generatePartnerQRCode,
  generateQRCodeBuffer
};
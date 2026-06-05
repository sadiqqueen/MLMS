// backend/middleware/honeypot.js
const { logSecurityEvent } = require('./securityEventLogger');

const SUSPICIOUS_PATTERNS = [
  { re: /(^|\/)\.(git|svn|hg)(\/|$)/i, reason: 'hidden_vcs_probe', severity: 'high' },
  { re: /(^|\/)\.env(\.|$|\/)/i, reason: 'env_file_probe', severity: 'high' },
  { re: /(^|\/)(wp-admin|wp-login\.php|xmlrpc\.php)(\/|$)/i, reason: 'wordpress_probe', severity: 'medium' },
  { re: /(^|\/)(phpmyadmin|phpMyAdmin|pma|adminer)(\/|\.php|$)/i, reason: 'database_admin_probe', severity: 'high' },
  { re: /\.(php|aspx|jsp|cgi)(\/|$|\?)/i, reason: 'server_script_probe', severity: 'medium' },
  { re: /(^|\/)(config|backup|dump|db|database|sql)(\.|\/|$)/i, reason: 'config_or_backup_probe', severity: 'medium' }
];

module.exports = function honeypot() {
  return (req, res, next) => {
    const requestPath = req.path || req.originalUrl || '';
    const match = SUSPICIOUS_PATTERNS.find(({ re }) => re.test(requestPath));
    if (!match) return next();

    logSecurityEvent(req, {
      type: 'honeypot',
      severity: match.severity,
      reason: match.reason,
      statusCode: 404,
      metadata: {
        queryPresent: Boolean(req.url && req.url.includes('?'))
      }
    });

    return res.status(404).json({ success: false, message: 'Route not found' });
  };
};

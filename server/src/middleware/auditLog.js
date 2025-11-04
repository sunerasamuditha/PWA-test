const { executeQuery } = require('../config/database');
const { sanitizeForLog } = require('../utils/securityUtils');

/**
 * Sanitize data specifically for audit logging
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
const sanitizeForAudit = (data) => {
  if (!data) return data;
  
  // Use general sanitizeForLog first
  let sanitized = sanitizeForLog(data);
  
  // Additional audit-specific sanitization
  if (typeof sanitized === 'object' && sanitized !== null) {
    const sensitive = ['password', 'token', 'secret', 'authorization', 'apiKey', 'privateKey'];
    const result = { ...sanitized };
    
    for (const key of Object.keys(result)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        result[key] = '[REDACTED]';
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = sanitizeForAudit(result[key]);
      }
    }
    
    return result;
  }
  
  return sanitized;
};

/**
 * Log an action to the audit_logs table
 * @param {object} options - Logging options
 * @param {number} options.userId - User ID performing the action
 * @param {string} options.action - Action performed (create, update, delete, login, logout, access)
 * @param {string} options.targetEntity - Entity being acted upon
 * @param {number} options.targetId - ID of the target entity
 * @param {object} options.detailsBefore - State before the action (JSON)
 * @param {object} options.detailsAfter - State after the action (JSON)
 * @param {string} options.ipAddress - IP address of the user
 * @param {string} options.userAgent - User agent string
 * @returns {Promise<number>} Insert ID of the created audit log
 */
const logAction = async ({
  userId,
  action,
  targetEntity,
  targetId = null,
  detailsBefore = null,
  detailsAfter = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    const sql = `
      INSERT INTO Audit_Logs (
        user_id, action, target_entity, target_id, 
        details_before, details_after, ip_address, user_agent, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    // Sanitize sensitive data before logging
    const sanitizedBefore = sanitizeForAudit(detailsBefore);
    const sanitizedAfter = sanitizeForAudit(detailsAfter);

    const result = await executeQuery(sql, [
      userId,
      action,
      targetEntity,
      targetId,
      sanitizedBefore ? JSON.stringify(sanitizedBefore) : null,
      sanitizedAfter ? JSON.stringify(sanitizedAfter) : null,
      ipAddress,
      userAgent
    ]);

    return result.insertId;
  } catch (error) {
    // Log audit errors but don't fail the main operation
    console.error('Audit logging failed:', error.message);
    return null;
  }
};

/**
 * Middleware to log successful login actions
 */
const auditLogin = (req, res, next) => {
  res.on('finish', async () => {
    try {
      // Only log if the response was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = res.locals.user;
        
        if (user) {
          await logAction({
            userId: user.id,
            action: 'login',
            targetEntity: 'Users',
            targetId: user.id,
            detailsAfter: {
              email: user.email,
              role: user.role,
              loginTime: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Login audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log logout actions
 */
const auditLogout = async (req, res, next) => {
  try {
    // Only log if the response was successful (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const user = req.user;
      
      if (user) {
        await logAction({
          userId: user.id,
          action: 'logout',
          targetEntity: 'Users',
          targetId: user.id,
          detailsAfter: {
            email: user.email,
            role: user.role,
            logoutTime: new Date().toISOString()
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        });
      }
    }
  } catch (error) {
    console.error('Logout audit logging failed:', error.message);
  }
  
  next();
};

/**
 * Middleware to log user registration
 */
const auditRegistration = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = res.locals.user;
        
        if (user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'Users',
            targetId: user.id,
            detailsAfter: {
              email: user.email,
              role: user.role,
              fullName: user.fullName,
              registrationTime: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Registration audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log profile updates
 */
const auditProfileUpdate = async (req, res, next) => {
  try {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const user = req.user;
      const updateData = req.body;
      
      if (user) {
        await logAction({
          userId: user.id,
          action: 'update',
          targetEntity: 'Users',
          targetId: user.id,
          detailsBefore: {
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            address: user.address,
            emergencyContact: user.emergencyContact
          },
          detailsAfter: updateData,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        });
      }
    }
  } catch (error) {
    console.error('Profile update audit logging failed:', error.message);
  }
  
  next();
};

/**
 * Middleware to log password changes
 */
const auditPasswordChange = async (req, res, next) => {
  try {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const user = req.user;
      
      if (user) {
        await logAction({
          userId: user.id,
          action: 'update',
          targetEntity: 'Users',
          targetId: user.id,
          detailsAfter: {
            action: 'password_change',
            changeTime: new Date().toISOString()
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        });
      }
    }
  } catch (error) {
    console.error('Password change audit logging failed:', error.message);
  }
  
  next();
};

/**
 * Generic audit middleware for CRUD operations
 * @param {string} action - The action being performed
 * @param {string} targetEntity - The entity being acted upon
 * @returns {function} Middleware function
 */
const auditCRUD = (action, targetEntity) => {
  return async (req, res, next) => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        
        if (user) {
          const targetId = req.params.id || res.locals.entityId;
          const detailsBefore = res.locals.beforeData || null;
          const detailsAfter = res.locals.afterData || req.body;
          
          await logAction({
            userId: user.id,
            action,
            targetEntity,
            targetId,
            detailsBefore,
            detailsAfter,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error(`${action} audit logging failed:`, error.message);
    }
    
    next();
  };
};

/**
 * Middleware to log access attempts to sensitive resources
 */
const auditAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (user) {
        await logAction({
          userId: user.id,
          action: 'access',
          targetEntity: resourceType,
          targetId: req.params.id || null,
          detailsAfter: {
            endpoint: req.originalUrl,
            method: req.method,
            accessTime: new Date().toISOString()
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        });
      }
    } catch (error) {
      console.error('Access audit logging failed:', error.message);
    }
    
    next();
  };
};

/**
 * Middleware to log user creation by admin
 */
const auditUserCreate = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const adminUser = req.user;
        const createdUser = res.locals.user;
        
        if (adminUser && createdUser) {
          await logAction({
            userId: adminUser.id,
            action: 'create',
            targetEntity: 'Users',
            targetId: createdUser.id,
            detailsAfter: {
              createdUser: {
                id: createdUser.id,
                email: createdUser.email,
                role: createdUser.role,
                fullName: createdUser.fullName
              },
              createdBy: adminUser.id,
              creationTime: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('User creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log user updates by admin
 */
const auditUserUpdate = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const adminUser = req.user;
        const userBefore = res.locals.userBefore;
        const updatedUser = res.locals.user;
        
        if (adminUser && userBefore && updatedUser) {
          await logAction({
            userId: adminUser.id,
            action: 'update',
            targetEntity: 'Users',
            targetId: updatedUser.id,
            detailsBefore: {
              fullName: userBefore.fullName,
              role: userBefore.role,
              phoneNumber: userBefore.phoneNumber,
              dateOfBirth: userBefore.dateOfBirth,
              address: userBefore.address,
              emergencyContact: userBefore.emergencyContact,
              isActive: userBefore.isActive
            },
            detailsAfter: {
              fullName: updatedUser.fullName,
              role: updatedUser.role,
              phoneNumber: updatedUser.phoneNumber,
              dateOfBirth: updatedUser.dateOfBirth,
              address: updatedUser.address,
              emergencyContact: updatedUser.emergencyContact,
              isActive: updatedUser.isActive,
              updatedBy: adminUser.id,
              updateTime: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('User update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log user deactivation by admin
 */
const auditUserDeactivate = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const adminUser = req.user;
        const deactivatedUser = res.locals.user;
        
        if (adminUser && deactivatedUser) {
          await logAction({
            userId: adminUser.id,
            action: 'delete',
            targetEntity: 'Users',
            targetId: deactivatedUser.id,
            detailsAfter: {
              deactivatedUser: {
                id: deactivatedUser.id,
                email: deactivatedUser.email,
                role: deactivatedUser.role,
                fullName: deactivatedUser.fullName
              },
              deactivatedBy: adminUser.id,
              deactivationTime: new Date().toISOString(),
              action: 'user_deactivation'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('User deactivation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log user reactivation by admin
 */
const auditUserReactivate = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const adminUser = req.user;
        const reactivatedUser = res.locals.user;
        
        if (adminUser && reactivatedUser) {
          await logAction({
            userId: adminUser.id,
            action: 'update',
            targetEntity: 'Users',
            targetId: reactivatedUser.id,
            detailsAfter: {
              reactivatedUser: {
                id: reactivatedUser.id,
                email: reactivatedUser.email,
                role: reactivatedUser.role,
                fullName: reactivatedUser.fullName
              },
              reactivatedBy: adminUser.id,
              reactivationTime: new Date().toISOString(),
              action: 'user_reactivation'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('User reactivation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log patient profile updates
 */
const auditPatientUpdate = async (req, res, next) => {
  // Fetch current patient profile before update for accurate before state
  let originalPatientData = null;
  try {
    if (req.user && req.user.id) {
      const Patient = require('../models/Patient');
      originalPatientData = await Patient.findByUserId(req.user.id);
    }
  } catch (error) {
    console.error('Error fetching original patient data for audit:', error.message);
    originalPatientData = { ...req.body }; // Fallback to request body
  }
  
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        const updatedData = res.locals.updatedPatient;
        
        if (user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Patients',
            targetId: user.id,
            detailsBefore: originalPatientData,
            detailsAfter: {
              updatedProfile: updatedData,
              updateTime: new Date().toISOString(),
              action: 'patient_profile_update'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Patient update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log partner registration
 */
const auditPartnerRegistration = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const partnerData = res.locals.partner;
        const userData = res.locals.user;
        
        if (userData && partnerData) {
          await logAction({
            userId: userData.id,
            action: 'create',
            targetEntity: 'Partners',
            targetId: partnerData.id || userData.id,
            detailsAfter: {
              partner: {
                user_id: partnerData.user_id,
                type: partnerData.type,
                status: partnerData.status
              },
              user: {
                fullName: userData.fullName,
                email: userData.email,
                role: userData.role
              },
              registrationTime: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Partner registration audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log partner profile updates
 */
const auditPartnerUpdate = async (req, res, next) => {
  // Fetch current partner profile before update
  let originalPartnerData = null;
  try {
    if (req.user && req.user.id) {
      const Partner = require('../models/Partner');
      originalPartnerData = await Partner.findByUserId(req.user.id);
    }
  } catch (error) {
    console.error('Error fetching original partner data for audit:', error.message);
  }
  
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        const updatedData = res.locals.updatedPartner;
        
        if (user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Partners',
            targetId: user.id,
            detailsBefore: originalPartnerData,
            detailsAfter: {
              updatedProfile: updatedData,
              updateTime: new Date().toISOString(),
              action: 'partner_profile_update'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Partner update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log partner status updates by admin
 */
const auditPartnerStatusUpdate = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const adminUser = req.user;
        const partnerBefore = res.locals.partnerBefore;
        const updatedPartner = res.locals.updatedPartner;
        
        if (adminUser && partnerBefore && updatedPartner) {
          await logAction({
            userId: adminUser.id,
            action: 'update',
            targetEntity: 'Partners',
            targetId: req.params.partnerId,
            detailsBefore: {
              status: partnerBefore.status,
              type: partnerBefore.type,
              commission_points: partnerBefore.commission_points
            },
            detailsAfter: {
              status: updatedPartner.status,
              type: updatedPartner.type,
              commission_points: updatedPartner.commission_points,
              updatedBy: adminUser.id,
              updateTime: new Date().toISOString(),
              action: 'partner_status_update'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Partner status update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log referral creation
 */
const auditReferralCreation = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const referralData = res.locals.referral;
        
        if (referralData) {
          // Log from partner perspective
          await logAction({
            userId: referralData.partner_user_id,
            action: 'create',
            targetEntity: 'Referrals',
            targetId: referralData.id,
            detailsAfter: {
              referral: {
                partner_user_id: referralData.partner_user_id,
                patient_user_id: referralData.patient_user_id,
                commission_amount: referralData.commission_amount,
                status: referralData.status
              },
              creationTime: new Date().toISOString(),
              action: 'referral_created'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
          
          // Also log from patient perspective
          await logAction({
            userId: referralData.patient_user_id,
            action: 'create',
            targetEntity: 'Referrals',
            targetId: referralData.id,
            detailsAfter: {
              referral: {
                partner_user_id: referralData.partner_user_id,
                patient_user_id: referralData.patient_user_id,
                commission_amount: referralData.commission_amount,
                status: referralData.status
              },
              creationTime: new Date().toISOString(),
              action: 'referred_by_partner'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Referral creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log QR code generation
 */
const auditQRGeneration = (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        
        if (user) {
          await logAction({
            userId: user.id,
            action: 'access',
            targetEntity: 'Partners',
            targetId: user.id,
            detailsAfter: {
              action: 'qr_code_generated',
              generationTime: new Date().toISOString(),
              partnerUuid: user.uuid
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('QR generation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log document uploads
 */
const auditDocumentUpload = async (req, res, next) => {
  // This runs after the controller
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const document = res.locals.document;
        const user = req.user;
        
        if (document && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'documents',
            targetId: document.id,
            detailsAfter: {
              patientUserId: document.patientUserId,
              type: document.type,
              originalFilename: document.originalFilename,
              fileSize: document.fileSize,
              mimeType: document.mimeType
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Document upload audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log document downloads/views
 */
const auditDocumentDownload = async (req, res, next) => {
  // This runs after the controller
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        const documentId = req.params.id;
        
        if (user && documentId) {
          await logAction({
            userId: user.id,
            action: 'access',
            targetEntity: 'documents',
            targetId: parseInt(documentId),
            detailsAfter: {
              action: req.path.includes('/download') ? 'download' : 'view'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Document download audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log document deletions
 */
const auditDocumentDelete = async (req, res, next) => {
  // This runs after the controller
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const deletedDocument = res.locals.deletedDocument;
        const user = req.user;
        
        if (deletedDocument && user) {
          await logAction({
            userId: user.id,
            action: 'delete',
            targetEntity: 'documents',
            targetId: deletedDocument.id,
            detailsBefore: {
              patientUserId: deletedDocument.patientUserId,
              type: deletedDocument.type,
              originalFilename: deletedDocument.originalFilename,
              fileSize: deletedDocument.fileSize,
              filePath: deletedDocument.filePath
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Document delete audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log appointment creation
 */
const auditAppointmentCreate = async (req, res, next) => {
  // This runs after the controller
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const appointment = res.locals.appointment;
        const user = req.user;
        
        if (appointment && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'Appointments',
            targetId: appointment.id,
            detailsAfter: {
              patientUserId: appointment.patientUserId,
              appointmentDatetime: appointment.appointmentDatetime,
              appointmentType: appointment.appointmentType,
              status: appointment.status,
              createdByStaffId: appointment.createdByStaffId
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Appointment creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log appointment updates
 */
const auditAppointmentUpdate = async (req, res, next) => {
  // Fetch original appointment data before update
  let originalAppointment = null;
  try {
    if (req.params.id) {
      const Appointment = require('../models/Appointment');
      originalAppointment = await Appointment.findById(parseInt(req.params.id));
    }
  } catch (error) {
    console.error('Error fetching original appointment for audit:', error.message);
  }
  
  // This runs after the controller
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const appointment = res.locals.appointment;
        const user = req.user;
        
        if (appointment && user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Appointments',
            targetId: appointment.id,
            detailsBefore: originalAppointment ? {
              appointmentDatetime: originalAppointment.appointmentDatetime,
              status: originalAppointment.status,
              appointmentType: originalAppointment.appointmentType,
              notes: originalAppointment.notes
            } : null,
            detailsAfter: {
              appointmentDatetime: appointment.appointmentDatetime,
              status: appointment.status,
              appointmentType: appointment.appointmentType,
              notes: appointment.notes,
              updatedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Appointment update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log appointment cancellation
 */
const auditAppointmentCancel = async (req, res, next) => {
  // This runs after the controller
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const beforeAppointment = res.locals.beforeAppointment;
        const appointment = res.locals.appointment;
        const user = req.user;
        
        if (beforeAppointment && appointment && user) {
          await logAction({
            userId: user.id,
            action: 'delete',
            targetEntity: 'Appointments',
            targetId: appointment.id,
            detailsBefore: {
              patientUserId: beforeAppointment.patientUserId,
              appointmentDatetime: beforeAppointment.appointmentDatetime,
              appointmentType: beforeAppointment.appointmentType,
              status: beforeAppointment.status
            },
            detailsAfter: {
              patientUserId: appointment.patientUserId,
              appointmentDatetime: appointment.appointmentDatetime,
              appointmentType: appointment.appointmentType,
              status: 'cancelled',
              cancelledBy: user.id,
              cancelledAt: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Appointment cancellation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log service creation
 */
const auditServiceCreate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const service = res.locals.auditData?.service;
        const user = req.user;
        
        if (service && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'Services',
            targetId: service.id,
            detailsAfter: {
              name: service.name,
              description: service.description,
              price: service.price,
              serviceCategory: service.serviceCategory,
              isActive: service.isActive
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Service creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log service updates
 */
const auditServiceUpdate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const service = res.locals.auditData?.service;
        const user = req.user;
        
        if (service && user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Services',
            targetId: service.id,
            detailsAfter: {
              name: service.name,
              description: service.description,
              price: service.price,
              serviceCategory: service.serviceCategory,
              isActive: service.isActive,
              updatedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Service update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log invoice creation
 */
const auditInvoiceCreate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const invoice = res.locals.auditData?.invoice;
        const user = req.user;
        
        if (invoice && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'Invoices',
            targetId: invoice.id,
            detailsAfter: {
              invoiceNumber: invoice.invoiceNumber,
              patientUserId: invoice.patientUserId,
              invoiceType: invoice.invoiceType,
              paymentMethod: invoice.paymentMethod,
              totalAmount: invoice.totalAmount,
              status: invoice.status,
              items: invoice.items,
              preparedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Invoice creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log invoice updates
 */
const auditInvoiceUpdate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const invoice = res.locals.auditData?.invoice;
        const user = req.user;
        
        if (invoice && user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Invoices',
            targetId: invoice.id,
            detailsAfter: {
              invoiceNumber: invoice.invoiceNumber,
              totalAmount: invoice.totalAmount,
              status: invoice.status,
              dueDate: invoice.dueDate,
              updatedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Invoice update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log invoice receipt downloads
 */
const auditInvoiceDownload = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const auditData = res.locals.auditData;
        const user = req.user;
        
        if (auditData && user) {
          await logAction({
            userId: user.id,
            action: 'access',
            targetEntity: 'Invoices',
            targetId: auditData.invoiceId,
            detailsAfter: {
              action: 'download_receipt',
              invoiceNumber: auditData.invoiceNumber,
              downloadedAt: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Invoice download audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log payment recording
 */
const auditPaymentCreate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const auditData = res.locals.auditData;
        const user = req.user;
        
        if (auditData && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'Payments',
            targetId: auditData.payment.id,
            detailsAfter: {
              invoiceId: auditData.payment.invoiceId,
              amount: auditData.payment.amount,
              paymentMethod: auditData.payment.paymentMethod,
              transactionId: auditData.payment.transactionId,
              paymentStatus: auditData.payment.paymentStatus,
              invoiceStatus: auditData.invoiceStatus,
              recordedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Payment creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to audit shift updates by admin
 */
const auditShiftUpdate = async (req, res, next) => {
  try {
    // Store shift before update for audit trail
    const { StaffShift } = require('../models/StaffShift');
    const shiftId = parseInt(req.params.id);
    const shiftBefore = await StaffShift.findById(shiftId);
    
    if (shiftBefore) {
      res.locals.shiftBefore = shiftBefore;
    }

    // Continue to controller
    next();

    // After response finishes, log the update
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && res.locals.shift) {
        await logAction({
          userId: req.user.id,
          action: 'update',
          targetEntity: 'Staff_Shifts',
          targetId: res.locals.shift.id,
          detailsBefore: res.locals.shiftBefore,
          detailsAfter: res.locals.shift,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        });
      }
    });
  } catch (error) {
    console.error('Shift update audit logging failed:', error.message);
    next();
  }
};

/**
 * Middleware to audit monthly shift report downloads
 */
const auditShiftReportDownload = async (req, res, next) => {
  try {
    // Continue to controller
    next();

    // After response finishes, log the download
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const { staffUserId, year, month } = req.query;
        
        await logAction({
          userId: req.user.id,
          action: 'access',
          targetEntity: 'Staff_Shifts',
          targetId: staffUserId ? parseInt(staffUserId) : req.user.id,
          detailsAfter: {
            reportType: 'monthly_shift_report',
            year: parseInt(year),
            month: parseInt(month),
            downloadedAt: new Date().toISOString()
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent') || 'Unknown'
        });
      }
    });
  } catch (error) {
    console.error('Shift report download audit logging failed:', error.message);
    next();
  }
};

/**
 * Middleware to log external entity creation
 */
const auditEntityCreate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entity = res.locals.entity;
        const user = req.user;
        
        if (entity && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'External_Entities',
            targetId: entity.id,
            detailsAfter: {
              name: entity.name,
              type: entity.type,
              contactInfo: entity.contactInfo,
              createdBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Entity creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log external entity updates
 */
const auditEntityUpdate = async (req, res, next) => {
  // Fetch original entity data before update
  let originalEntity = null;
  try {
    if (req.params.id) {
      const ExternalEntity = require('../models/ExternalEntity');
      originalEntity = await ExternalEntity.findById(parseInt(req.params.id));
    }
  } catch (error) {
    console.error('Error fetching original entity for audit:', error.message);
  }
  
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entity = res.locals.entity;
        const user = req.user;
        
        if (entity && user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'External_Entities',
            targetId: entity.id,
            detailsBefore: originalEntity ? {
              name: originalEntity.name,
              type: originalEntity.type,
              contactInfo: originalEntity.contactInfo
            } : null,
            detailsAfter: {
              name: entity.name,
              type: entity.type,
              contactInfo: entity.contactInfo,
              updatedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Entity update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log external entity deletion
 */
const auditEntityDelete = async (req, res, next) => {
  // Fetch entity data before deletion
  let deletedEntity = null;
  try {
    if (req.params.id) {
      const ExternalEntity = require('../models/ExternalEntity');
      deletedEntity = await ExternalEntity.findById(parseInt(req.params.id));
    }
  } catch (error) {
    console.error('Error fetching entity for deletion audit:', error.message);
  }
  
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user;
        
        if (deletedEntity && user) {
          await logAction({
            userId: user.id,
            action: 'delete',
            targetEntity: 'External_Entities',
            targetId: deletedEntity.id,
            detailsBefore: {
              name: deletedEntity.name,
              type: deletedEntity.type,
              contactInfo: deletedEntity.contactInfo
            },
            detailsAfter: {
              deletedBy: user.id,
              deletedAt: new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Entity deletion audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log accounts payable creation
 */
const auditPayableCreate = async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payable = res.locals.payable;
        const user = req.user;
        
        if (payable && user) {
          await logAction({
            userId: user.id,
            action: 'create',
            targetEntity: 'Accounts_Payable',
            targetId: payable.id,
            detailsAfter: {
              entityId: payable.entityId,
              referenceCode: payable.referenceCode,
              totalAmount: payable.totalAmount,
              dueDate: payable.dueDate,
              status: payable.status,
              createdBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Payable creation audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log accounts payable updates
 */
const auditPayableUpdate = async (req, res, next) => {
  // Fetch original payable data before update
  let originalPayable = null;
  try {
    if (req.params.id) {
      const AccountsPayable = require('../models/AccountsPayable');
      originalPayable = await AccountsPayable.findById(parseInt(req.params.id));
    }
  } catch (error) {
    console.error('Error fetching original payable for audit:', error.message);
  }
  
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payable = res.locals.payable;
        const user = req.user;
        
        if (payable && user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Accounts_Payable',
            targetId: payable.id,
            detailsBefore: originalPayable ? {
              totalAmount: originalPayable.totalAmount,
              dueDate: originalPayable.dueDate,
              status: originalPayable.status,
              description: originalPayable.description
            } : null,
            detailsAfter: {
              totalAmount: payable.totalAmount,
              dueDate: payable.dueDate,
              status: payable.status,
              description: payable.description,
              updatedBy: user.id
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Payable update audit logging failed:', error.message);
    }
  });
  
  next();
};

/**
 * Middleware to log marking payable as paid
 */
const auditPayableMarkPaid = async (req, res, next) => {
  // Fetch original payable data before marking as paid
  let originalPayable = null;
  try {
    if (req.params.id) {
      const AccountsPayable = require('../models/AccountsPayable');
      originalPayable = await AccountsPayable.findById(parseInt(req.params.id));
    }
  } catch (error) {
    console.error('Error fetching original payable for mark paid audit:', error.message);
  }
  
  res.on('finish', async () => {
    try {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payable = res.locals.payable;
        const user = req.user;
        
        if (payable && user) {
          await logAction({
            userId: user.id,
            action: 'update',
            targetEntity: 'Accounts_Payable',
            targetId: payable.id,
            detailsBefore: originalPayable ? {
              status: originalPayable.status,
              paidDate: originalPayable.paidDate,
              paymentMethod: originalPayable.paymentMethod
            } : null,
            detailsAfter: {
              status: 'paid',
              paidDate: payable.paidDate,
              paymentMethod: payable.paymentMethod,
              totalAmount: payable.totalAmount,
              markedPaidBy: user.id,
              action: 'marked_as_paid'
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown'
          });
        }
      }
    } catch (error) {
      console.error('Payable mark paid audit logging failed:', error.message);
    }
  });
  
  next();
};

module.exports = {
  logAction,
  auditLogin,
  auditLogout,
  auditRegistration,
  auditProfileUpdate,
  auditPasswordChange,
  auditCRUD,
  auditAccess,
  auditUserCreate,
  auditUserUpdate,
  auditUserDeactivate,
  auditUserReactivate,
  auditPatientUpdate,
  auditPartnerRegistration,
  auditPartnerUpdate,
  auditPartnerStatusUpdate,
  auditReferralCreation,
  auditQRGeneration,
  // Document related audits
  auditDocumentUpload,
  auditDocumentDownload,
  auditDocumentDelete,
  // Appointment related audits
  auditAppointmentCreate,
  auditAppointmentUpdate,
  auditAppointmentCancel,
  // Billing related audits
  auditServiceCreate,
  auditServiceUpdate,
  auditInvoiceCreate,
  auditInvoiceUpdate,
  auditInvoiceDownload,
  auditPaymentCreate,
  // Shift related audits
  auditShiftUpdate,
  auditShiftReportDownload,
  // External entity related audits
  auditEntityCreate,
  auditEntityUpdate,
  auditEntityDelete,
  // Accounts payable related audits
  auditPayableCreate,
  auditPayableUpdate,
  auditPayableMarkPaid
};
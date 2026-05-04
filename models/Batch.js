const mongoose = require('mongoose');

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 20;

const BatchSchema = new mongoose.Schema({
  profession:  { type: String, required: true },   // e.g. "nurse"
  batchCode:   { type: String, required: true, unique: true }, // e.g. "NRS-B001"
  batchNumber: { type: Number, required: true },   // 1, 2, 3 ...
  count:       { type: Number, default: 0 },       // current members
  maxSize:     { type: Number, default: BATCH_SIZE },
  isFull:      { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now }
});

// Prefix map for each profession
BatchSchema.statics.PREFIX = {
  nurse:        'NRS',
  caregiver:    'CGV',
  construction: 'CON',
  truck:        'TRK',
  gardener:     'GRD'
};

/**
 * Find the active (non-full) batch for a profession,
 * or create a new one if none exists.
 */
BatchSchema.statics.getOrCreate = async function(profession) {
  const prefix = this.PREFIX[profession.toLowerCase()] || 'GEN';

  // Find open batch
  let batch = await this.findOne({ profession, isFull: false });

  if (!batch) {
    // Count existing batches for this profession to get next number
    const count = await this.countDocuments({ profession });
    const batchNumber = count + 1;
    const batchCode   = `${prefix}-B${String(batchNumber).padStart(3, '0')}`;
    batch = await this.create({ profession, batchCode, batchNumber });
  }

  return batch;
};

/**
 * Add an applicant to the batch. Mark full if limit reached.
 */
BatchSchema.statics.addMember = async function(batchId) {
  const batch = await this.findById(batchId);
  batch.count += 1;
  if (batch.count >= batch.maxSize) batch.isFull = true;
  await batch.save();
  return batch;
};

module.exports = mongoose.model('Batch', BatchSchema);

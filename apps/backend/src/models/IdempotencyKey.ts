import { Schema, model, Document, Types } from 'mongoose';

export interface IIdempotencyKey extends Document {
  _id: Types.ObjectId;
  key: string;
  responseBody: string;
  statusCode: number;
  createdAt: Date;
}

const idempotencySchema = new Schema<IIdempotencyKey>(
  {
    key:          { type: String, required: true, unique: true },
    responseBody: { type: String, required: true },
    statusCode:   { type: Number, required: true },
  },
  { timestamps: true }
);

// Auto-expire after 7 days
idempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const IdempotencyKey = model<IIdempotencyKey>('IdempotencyKey', idempotencySchema);

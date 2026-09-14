import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash:     { type: String, required: true },
    displayName:      { type: String, required: true, trim: true },
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);

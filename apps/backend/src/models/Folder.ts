import { Schema, model, Document, Types } from 'mongoose';

export interface IFolder extends Document {
  _id: Types.ObjectId;
  clientId: string;
  parentId: Types.ObjectId | null;
  ownerId: Types.ObjectId;
  name: string;
  path: string;
  color: string | null;
  icon: string | null;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const folderSchema = new Schema<IFolder>(
  {
    clientId:  { type: String, required: true },
    parentId:  { type: Schema.Types.ObjectId, ref: 'Folder', default: null },
    ownerId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:      { type: String, required: true, trim: true },
    path:      { type: String, default: '' },
    color:     { type: String, default: null },
    icon:      { type: String, default: null },
    isFavorite: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevent duplicate clientId per owner
folderSchema.index({ ownerId: 1, clientId: 1 }, { unique: true });
folderSchema.index({ ownerId: 1, parentId: 1 });

export const Folder = model<IFolder>('Folder', folderSchema);

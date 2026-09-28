import { Schema, model, Document as MongoDocument, Types } from 'mongoose';

export interface IDocument extends MongoDocument {
  _id: Types.ObjectId;
  clientId: string;
  folderId: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  mimeType: string;
  storageKey: string;
  fileSize: number;
  contentHash: string | null;
  isFavorite: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const documentSchema = new Schema<IDocument>(
  {
    clientId:    { type: String, required: true },
    folderId:    { type: Schema.Types.ObjectId, ref: 'Folder', required: true },
    ownerId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:        { type: String, required: true, trim: true },
    mimeType:    { type: String, required: true },
    storageKey:  { type: String, required: true },
    fileSize:    { type: Number, required: true },
    contentHash: { type: String, default: null },
    isFavorite:  { type: Boolean, default: false },
    tags:        { type: [String], default: [] },
    deletedAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

documentSchema.index({ ownerId: 1, clientId: 1 }, { unique: true });
documentSchema.index({ ownerId: 1, folderId: 1 });

export const Doc = model<IDocument>('Document', documentSchema);

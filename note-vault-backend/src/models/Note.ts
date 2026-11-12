import mongoose, { Document } from "mongoose";

export interface NoteDocument extends Document {
  owner: mongoose.Types.ObjectId;
  title: string;
  content: string;
}

/**
 * Query -> Index that serves it
 * -----------------------------------------------------------------
 * List my notes, admin ?owner filter, countDocuments({ owner }),
 * deleteMany({ owner })                         { owner: 1, _id: -1 }
 * Admin list all notes (sort _id desc)          default _id
 * GET /notes/:id                                default _id
 * Update / delete note by id                    default _id
 */

const noteSchema = new mongoose.Schema<NoteDocument>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
  },
  { timestamps: true },
);

// Listing every note (admin, no owner filter) and fetching one note by id
// use the default _id index. The compound index exists only for predicates
// that filter by owner and still sort newest-first on _id.
noteSchema.index({ owner: 1, _id: -1 });

function hideVersion(_doc: NoteDocument, ret: NoteDocument & { __v?: number }): NoteDocument & { __v?: number } {
  delete ret.__v;
  return ret;
}

noteSchema.set("toJSON", { transform: hideVersion });
noteSchema.set("toObject", { transform: hideVersion });

const Note = mongoose.model<NoteDocument>("Note", noteSchema);

export default Note;

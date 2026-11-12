import mongoose, { Document } from "mongoose";

export interface PostDocument extends Document {
  author: mongoose.Types.ObjectId;
  title: string;
  content: string;
}

/**
 * Query -> Index that serves it
 * -----------------------------------------------------------------
 * Posts of a user via $lookup (match author, sort _id desc),
 * deleteMany({ author })                        { author: 1, _id: -1 }
 * Global feed, GET /posts/:id                   default _id
 * Update / delete post by id                    default _id
 */

const postSchema = new mongoose.Schema<PostDocument>(
  {
    author: {
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

// The global feed and post-id lookups use the default _id index. The compound
// index serves the author equality inside the user-posts $lookup (plus _id
// descending sort) and deleteMany({ author }).
postSchema.index({ author: 1, _id: -1 });

function hideVersion(_doc: PostDocument, ret: PostDocument & { __v?: number }): PostDocument & { __v?: number } {
  delete ret.__v;
  return ret;
}

postSchema.set("toJSON", { transform: hideVersion });
postSchema.set("toObject", { transform: hideVersion });

const Post = mongoose.model<PostDocument>("Post", postSchema);

export default Post;

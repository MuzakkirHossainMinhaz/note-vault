import { FilterQuery } from "mongoose";
import Note, { NoteDocument } from "../models/Note";
import asyncHandler from "../utils/asyncHandler";
import httpError from "../utils/httpError";
import { paginate, parsePagination } from "../utils/pagination";

const createNote = asyncHandler(async (req, res) => {
  const note = await Note.create({
    owner: req.user!._id,
    title: req.body.title,
    content: req.body.content,
  });
  res.status(201).json(note.toJSON());
});

const listNotes = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const isAdmin = req.user!.role === "admin";
  const filter: FilterQuery<NoteDocument> = {};

  if (isAdmin) {
    if (typeof req.query.owner === "string") filter.owner = req.query.owner;
  } else {
    filter.owner = req.user!._id;
  }

  const result = await paginate(Note, filter, pagination, (query) => {
    if (!isAdmin) return query;
    return query.populate({ path: "owner", select: "name email" });
  });

  res.json(result);
});

const getNote = asyncHandler(async (req, res) => {
  const filter: FilterQuery<NoteDocument> = { _id: req.params.id };
  if (req.user!.role !== "admin") {
    filter.owner = req.user!._id;
  }

  const note = await Note.findOne(filter);
  if (!note) {
    throw httpError(404, "Note not found");
  }

  res.json(note.toJSON());
});

async function findOwnNote(req: import("express").Request): Promise<NoteDocument> {
  const note = await Note.findOne({
    _id: req.params.id,
    owner: req.user!._id,
  });
  if (!note) {
    throw httpError(404, "Note not found");
  }
  return note;
}

const updateNote = asyncHandler(async (req, res) => {
  const note = await findOwnNote(req);
  if (req.body.title !== undefined) note.title = req.body.title;
  if (req.body.content !== undefined) note.content = req.body.content;
  await note.save();
  res.json(note.toJSON());
});

const deleteNote = asyncHandler(async (req, res) => {
  const note = await findOwnNote(req);
  await note.deleteOne();
  res.status(204).send();
});

export { createNote, deleteNote, getNote, listNotes, updateNote };

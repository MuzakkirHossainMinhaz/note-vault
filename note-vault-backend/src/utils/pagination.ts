import { FilterQuery, Model } from "mongoose";
import { ParsedQs } from "qs";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === undefined || value === "" ? undefined : value);

const paginationQuerySchema = z.object({
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).optional()),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
});

export interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function parsePagination(query: ParsedQs = {}): PaginationInput {
  const rawPage = query.page === undefined || query.page === "" ? 1 : Number(query.page);
  const rawLimit = query.limit === undefined || query.limit === "" ? 10 : Number(query.limit);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  let limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : 10;
  if (limit > 100) limit = 100;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function buildPagination(page: number, limit: number, total: number): PaginationResult {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function presentRow(row: Record<string, any>): Record<string, any> {
  const copy = { ...row };
  delete copy.__v;
  delete copy.password;
  if (copy.owner && typeof copy.owner === "object") {
    delete copy.owner.__v;
    delete copy.owner.password;
  }
  if (copy.author && typeof copy.author === "object") {
    delete copy.author.__v;
    delete copy.author.password;
  }
  return copy;
}

async function paginate(
  model: Model<any>,
  filter: FilterQuery<any>,
  pagination: PaginationInput,
  configure?: (query: any) => any,
) {
  let query = model.find(filter).sort({ _id: -1 }).skip(pagination.skip).limit(pagination.limit);

  if (typeof configure === "function") {
    const configured = configure(query);
    if (configured) query = configured;
  }

  const [rows, total] = await Promise.all([query.lean(), model.countDocuments(filter)]);

  return {
    data: rows.map(presentRow),
    pagination: buildPagination(pagination.page, pagination.limit, total),
  };
}

export { buildPagination, paginate, paginationQuerySchema, parsePagination };

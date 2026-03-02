"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  author: string;
  tags: string[];
  readingTimeMin: number;
  published: boolean;
  publishedAt: string;
  updatedAt: string;
}

interface BlogPostFull extends BlogPostSummary {
  content: string;
  contentEs: string;
}

type EditorMode = "list" | "create" | "edit";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<EditorMode>("list");
  const [editingPost, setEditingPost] = useState<BlogPostFull | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [titleEs, setTitleEs] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEs, setDescriptionEs] = useState("");
  const [content, setContent] = useState("");
  const [contentEs, setContentEs] = useState("");
  const [author, setAuthor] = useState("Profile Score Team");
  const [tags, setTags] = useState("");
  const [readingTimeMin, setReadingTimeMin] = useState(5);
  const [published, setPublished] = useState(false);

  const getAdminToken = () =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("adminToken") ?? ""
      : "";

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/blog", {
        headers: { "x-admin-token": getAdminToken() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setPosts(data.posts);
    } catch {
      setError("Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  function resetForm() {
    setSlug("");
    setTitle("");
    setTitleEs("");
    setDescription("");
    setDescriptionEs("");
    setContent("");
    setContentEs("");
    setAuthor("Profile Score Team");
    setTags("");
    setReadingTimeMin(5);
    setPublished(false);
    setEditingPost(null);
  }

  function handleNew() {
    resetForm();
    setMode("create");
  }

  async function handleEdit(post: BlogPostSummary) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        headers: { "x-admin-token": getAdminToken() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const full: BlogPostFull = data.post;

      setEditingPost(full);
      setSlug(full.slug);
      setTitle(full.title);
      setTitleEs(full.titleEs);
      setDescription(full.description);
      setDescriptionEs(full.descriptionEs);
      setContent(full.content);
      setContentEs(full.contentEs);
      setAuthor(full.author);
      setTags(full.tags.join(", "));
      setReadingTimeMin(full.readingTimeMin);
      setPublished(full.published);
      setMode("edit");
    } catch {
      setError("Failed to load post");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!slug.trim() || !title.trim()) {
      setError("Slug and title are required");
      return;
    }
    setSaving(true);
    setError("");

    const body = {
      slug: slug.trim(),
      title: title.trim(),
      titleEs: titleEs.trim(),
      description: description.trim(),
      descriptionEs: descriptionEs.trim(),
      content,
      contentEs,
      author: author.trim(),
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      readingTimeMin,
      published,
    };

    try {
      const isEdit = mode === "edit" && editingPost;
      const url = isEdit ? `/api/admin/blog/${editingPost.id}` : "/api/admin/blog";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getAdminToken(),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Error ${res.status}`);
        return;
      }

      setMode("list");
      resetForm();
      fetchPosts();
    } catch {
      setError("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this blog post? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": getAdminToken() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      fetchPosts();
    } catch {
      setError("Failed to delete post");
    }
  }

  async function handleTogglePublish(post: BlogPostSummary) {
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": getAdminToken(),
        },
        body: JSON.stringify({ published: !post.published }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      fetchPosts();
    } catch {
      setError("Failed to update post");
    }
  }

  // ── Editor View ───────────────────────────────────
  if (mode === "create" || mode === "edit") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            {mode === "create" ? "New Blog Post" : "Edit Blog Post"}
          </h1>
          <Button variant="ghost" size="sm" onClick={() => { setMode("list"); resetForm(); }}>
            Cancel
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-5">
          {/* Slug + Published */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="my-blog-post"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
              />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Reading Time (min)
                </label>
                <input
                  type="number"
                  value={readingTimeMin}
                  onChange={(e) => setReadingTimeMin(parseInt(e.target.value) || 5)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
                />
              </div>
              <label className="flex items-center gap-2 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">Published</span>
              </label>
            </div>
          </div>

          {/* Title EN + ES */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Title (EN) <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Title (ES)
              </label>
              <input
                value={titleEs}
                onChange={(e) => setTitleEs(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Description EN + ES */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description (EN)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description (ES)</label>
              <textarea
                value={descriptionEs}
                onChange={(e) => setDescriptionEs(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)] resize-none"
              />
            </div>
          </div>

          {/* Content EN */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Content (EN) — HTML
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 text-sm font-mono border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)] resize-y"
              placeholder="<h2>Section Title</h2><p>Paragraph text...</p>"
            />
          </div>

          {/* Content ES */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Content (ES) — HTML
            </label>
            <textarea
              value={contentEs}
              onChange={(e) => setContentEs(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 text-sm font-mono border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)] resize-y"
            />
          </div>

          {/* Author + Tags */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Author</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tags (comma-separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ats, resume, career"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleSave} disabled={saving || !slug.trim() || !title.trim()}>
              {saving ? "Saving..." : mode === "create" ? "Create Post" : "Save Changes"}
            </Button>
            <Button variant="ghost" onClick={() => { setMode("list"); resetForm(); }}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Blog Posts</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Create, edit, and manage blog content.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleNew}>
          + New Post
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <Card variant="default" padding="lg">
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
            <span className="ml-3 text-sm text-[var(--text-muted)]">Loading posts...</span>
          </div>
        </Card>
      ) : posts.length === 0 ? (
        <Card variant="default" padding="lg">
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            No blog posts yet. Create your first post!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} variant="default" padding="md" className="group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {post.title}
                    </h3>
                    <Badge variant={post.published ? "success" : "muted"}>
                      {post.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-2 truncate">
                    /{post.slug} · {post.readingTimeMin} min · {post.author}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                    {post.description}
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--surface-secondary)] text-[var(--text-muted)] rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleTogglePublish(post)}>
                    {post.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(post)}>
                    Edit
                  </Button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="text-xs text-[var(--text-muted)] hover:text-red-600 transition-colors px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

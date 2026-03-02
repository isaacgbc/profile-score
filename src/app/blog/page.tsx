import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog/posts";
import BlogIndexClient from "./BlogIndexClient";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Expert tips on LinkedIn optimization, ATS-friendly resumes, and career growth. Learn how to improve your professional profile and land more interviews.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | Profile Score",
    description:
      "Expert tips on LinkedIn optimization, ATS-friendly resumes, and career growth.",
    type: "website",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  return <BlogIndexClient posts={posts} />;
}

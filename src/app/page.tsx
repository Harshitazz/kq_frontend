"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push("/graph");
    }
  }, [isSignedIn, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">VectraMind</h1>
        <p className="text-gray-600">
          {isSignedIn ? "Redirecting to knowledge graph..." : "Please sign in to continue"}
        </p>
      </div>
    </div>
  );
}

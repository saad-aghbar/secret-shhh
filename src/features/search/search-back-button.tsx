"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { ShhhIconButton } from "@/components/shhh";

export function SearchBackButton() {
  const router = useRouter();
  return (
    <ShhhIconButton
      label="Back to More"
      data-testid="search-back"
      onClick={() => router.push("/more")}
    >
      <ArrowLeft className="size-5" strokeWidth={2.2} />
    </ShhhIconButton>
  );
}

import { Card, CardContent } from '@/components/ui/card';

interface PostCardSkeletonProps {
  count?: number;
}

export const PostCardSkeleton = ({ count = 1 }: PostCardSkeletonProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="py-0 my-[5px]">
          <Card className="overflow-hidden rounded-[20px] border border-white/20 bg-white/10 backdrop-blur-[10px] shadow-xl shadow-black/20">
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full shimmer" />
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-32 rounded-md shimmer" />
                    <div className="h-2.5 w-20 rounded-md shimmer" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-20 rounded-full shimmer" />
                  <div className="h-8 w-8 rounded-full shimmer" />
                </div>
              </div>

              <div className="relative">
                <div className="w-full min-h-[300px] bg-white/5 border-y border-white/10 shimmer" />
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full shimmer" />
                    <div className="h-8 w-8 rounded-full shimmer" />
                    <div className="h-8 w-8 rounded-full shimmer" />
                  </div>
                  <div className="h-4 w-10 rounded-md shimmer" />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="h-3 w-20 rounded-md shimmer" />
                  <div className="h-3 w-24 rounded-md shimmer" />
                </div>

                <div className="space-y-2">
                  <div className="h-3 w-[92%] rounded-md shimmer" />
                  <div className="h-3 w-[72%] rounded-md shimmer" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </>
  );
};

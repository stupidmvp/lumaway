"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Loader2, UploadCloud, X, Info, Download, File } from "lucide-react";
import { Button } from "./button";
import { Progress } from "./progress";
import { S3UrlSigningService } from "@luma/infra";
import axios from "axios";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ENV } from "@/lib/env";
import { useTranslations } from "next-intl";

export interface IFile {
  id?: string | number;
  file_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  created_at?: string;
  updated_at?: string;
}

interface DefaultFilesProps {
  files: IFile[];
  isLoading?: boolean;
  className?: string;
}

export function DefaultFiles({
  files,
  isLoading,
  className,
}: DefaultFilesProps) {
  const handleDownload = async (file: {
    file_name: string;
    file_url: string;
  }) => {
    try {
      const response = await fetch(
        `${ENV.S3_URL_BASE}/${file.file_url}`
      );
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Download Error", {
        description: "Could not download the file",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-gray-100">
        <CardContent className="p-4">
          <div className="flex justify-center items-center h-24">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!files?.length) {
    return (
      <Card className="border-gray-100">
        <CardContent className="p-4">
          <div className="flex flex-col items-center justify-center gap-2 h-24">
            <File className="h-8 w-8 text-gray-400" />
            <p className="text-sm text-gray-500">No files available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-gray-100", className)}>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <File className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{file.file_name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-gray-100"
                onClick={() => handleDownload(file)}
              >
                <Download className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FileUploadProps {
  multiple?: boolean;
  allowedTypes?: string[];
  defaultFiles?: IFile[];
  maxSize?: number;
  maxFiles?: number;

  showDropzone?: boolean;
  showFiles?: boolean;
  showInfo?: boolean;
  showPlaceholder?: boolean;

  className?: string;
  contentClassName?: string;
  fileUploadButtonClassName?: string;
  fileUploadButtonVariant?:
    | "link"
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | null
    | undefined;
  icon?: React.ReactElement;
  children?: React.ReactElement | null;
  placeholder?: string;

  onUploadSuccess?: (files: FileWithProgress[]) => void;
  onUploadError?: (error: Error) => void;
  onFileRemove?: (file: FileWithProgress) => void;

  s3Type: string;
  entityId?: number | string;
  uploadPath?: string;
  additionalParams?: Record<string, unknown>;
  basePath?: string;
  signedUrlKey?: string;
}

export type FileWithProgress = {
  file: File;
  progress: number;
  fileUrl?: string;
  url?: string;
};

export const FileUpload = ({
  multiple = false,
  allowedTypes,
  maxSize = 10485760, // 10MB default
  maxFiles = 10,
  showDropzone = true,
  showFiles = true,
  showInfo = true,
  showPlaceholder = true,
  className,
  icon,
  fileUploadButtonClassName = "",
  fileUploadButtonVariant,
  placeholder,
  onUploadSuccess,
  onUploadError,
  onFileRemove,
  s3Type,
  basePath,
  additionalParams = {},
  defaultFiles,
  uploadPath,
  signedUrlKey = "file_url",
  contentClassName,
  children,
}: FileUploadProps) => {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const tf = useTranslations('FileUpload');

  const uploadToS3 = async (file: File): Promise<FileWithProgress> => {
    try {
      const fileUrl = `${basePath}/${file.name}`;

      const formData: Record<string, unknown> = {
        file_name: file.name,
        file_url: fileUrl,
        file_type: file.type,
        file_size: parseFloat(file.size.toString()),
        ...additionalParams,
      };

      // Prepare S3 signed URL params
      const s3Params: Record<string, unknown> = {
        type: s3Type,
        ...(uploadPath ? { path: uploadPath } : {}),
        filename: file.name,
      };

      // Add non-null additional params
      for (const [key, value] of Object.entries(additionalParams)) {
        if (value !== null) {
          s3Params[key] = value;
        }
      }

      // Get signed URL from S3 service
      const signedUrlResponse = await S3UrlSigningService.create(
        s3Params as {
          type: string;
          filename: string;
          path?: string;
          bucket?: string;
        }
      );

      const { signedUrl, s3PathWithoutBucket } = signedUrlResponse;
      formData[signedUrlKey] = s3PathWithoutBucket;

      // Upload file to S3
      await axios.put(signedUrl, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 0)
          );
          updateFileProgress(file, progress);
        },
      });

      return {
        ...signedUrlResponse,
        file,
        progress: 100,
        fileUrl: s3PathWithoutBucket,
        url: signedUrl,
      };
    } catch (error) {
      console.error("Error uploading to S3:", error);
      throw error;
    }
  };

  const updateFileProgress = (file: File, progress: number) => {
    setFiles((current) =>
      current.map((f) => (f.file === file ? { ...f, progress } : f))
    );
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "uploading" as const,
      }));

      setFiles((current) =>
        multiple ? [...current, ...newFiles] : [...newFiles]
      );
      setIsUploading(true);

      try {
        const uploadPromises = acceptedFiles.map((file) => uploadToS3(file));
        const uploadedFiles = await Promise.all(uploadPromises);
        onUploadSuccess?.(uploadedFiles);
      } catch (error) {
        console.error("Upload error:", error);
        onUploadError?.(error as Error);
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadSuccess, onUploadError, multiple]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept: allowedTypes
      ? Object.fromEntries(allowedTypes.map((type) => [type, []]))
      : undefined,
    maxSize,
    maxFiles,
  });

  const removeFile = (fileToRemove: FileWithProgress) => {
    setFiles((files) => files.filter((f) => f.file !== fileToRemove.file));
    onFileRemove?.(fileToRemove);
  };

  const getFileInfo = () => {
    const parts = [];
    if (allowedTypes?.length) {
      const extensions = allowedTypes
        .map((type) => (type.split("/")[1] ?? type).toUpperCase())
        .join(", ");
      parts.push(`Formats: ${extensions}`);
    }
    if (maxSize) {
      parts.push(`Max size: ${(maxSize / (1024 * 1024)).toFixed(0)}MB`);
    }
    if (maxFiles && multiple) {
      parts.push(`Max ${maxFiles} files`);
    }
    return parts.join(" · ");
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      {showDropzone ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative border border-dashed rounded-lg p-6 transition-all",
            "hover:border-primary/50 hover:bg-primary/5",
            isDragActive ? "border-primary bg-primary/10" : "border-gray-200",
            isUploading && "pointer-events-none opacity-50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm font-medium text-gray-700">
                  {isDragActive
                    ? tf('dropHere')
                    : multiple
                      ? tf('uploadFiles')
                      : tf('uploadFile')}
                </p>
                {showInfo && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Info className="h-4 w-4 text-gray-400" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        className="max-w-[500px] text-wrap"
                        side="bottom"
                      >
                        <p className="text-xs">{getFileInfo()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {tf('dragAndDrop')}
              </p>
              {children ? (
                <div>{React.cloneElement(children)}</div>
              ) : (
                <Button
                  variant={
                    fileUploadButtonVariant
                      ? fileUploadButtonVariant
                      : "default"
                  }
                  size="sm"
                  className={cn(
                    "mt-4 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                    fileUploadButtonClassName
                  )}
                  disabled={isUploading}
                  type="button"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {showPlaceholder && <span>{tf('uploading')}</span>}
                    </>
                  ) : (
                    <>
                      {icon || <UploadCloud className="mr-2 h-4 w-4" />}
                      {showPlaceholder && (
                        <span>
                          {placeholder ? (
                            <span>{placeholder}</span>
                          ) : (
                            <span>
                              {multiple ? tf('selectFiles') : tf('selectFile')}
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex",
            children ? "justify-start" : "justify-center",
            contentClassName
          )}
        >
          <div {...getRootProps()}>
            <input {...getInputProps()} />
            {children ? (
              <div>{children}</div>
            ) : (
              <Button
                disabled={isUploading}
                variant={
                  fileUploadButtonVariant
                    ? fileUploadButtonVariant
                    : "default"
                }
                size="sm"
                className={cn("relative group", fileUploadButtonClassName)}
                type="button"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {showPlaceholder && <span>{tf('uploading')}</span>}
                  </>
                ) : (
                  <>
                    {icon || <UploadCloud className="mr-2 h-4 w-4" />}
                    {showPlaceholder && (
                      <span>
                        {placeholder ? (
                          <span>{placeholder}</span>
                        ) : (
                          <span>
                            {multiple ? tf('selectFiles') : tf('selectFile')}
                          </span>
                        )}
                      </span>
                    )}
                    {showInfo && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Info className="ml-2 h-4 w-4 text-gray-400" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            className="max-w-[500px] text-wrap"
                            side="bottom"
                          >
                            <p className="text-xs">{getFileInfo()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File list */}
      {showFiles && files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileWithProgress, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-700">
                  {fileWithProgress.file.name}
                </p>
                <Progress
                  value={fileWithProgress.progress}
                  className="h-1 mt-2"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(fileWithProgress)}
                disabled={isUploading}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {defaultFiles && <DefaultFiles files={defaultFiles} />}
    </div>
  );
};


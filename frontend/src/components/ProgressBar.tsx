import React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import {
  DocumentTextIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

interface ProgressBarProps {
  currentStep: number;
}

const steps = [
  {
    id: 1,
    name: "Job Description",
    description: "Enter job requirements",
    icon: <DocumentTextIcon className="h-5 w-5" />,
  },
  {
    id: 2,
    name: "Upload Resumes",
    description: "Add candidate resumes",
    icon: <DocumentDuplicateIcon className="h-5 w-5" />,
  },
  {
    id: 3,
    name: "View Results",
    description: "Analyze matches",
    icon: <ChartBarIcon className="h-5 w-5" />,
  },
];

export default function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="mb-8 overflow-x-auto pb-2">
      <nav aria-label="Progress" className="py-2 min-w-max">
        <ol className="flex items-center">
          {steps.map((step, stepIdx) => (
            <li
              key={step.name}
              className={`${
                stepIdx !== steps.length - 1 ? "pr-8 sm:pr-20" : ""
              } relative flex-1`}
            >
              {/* Connector line */}
              {stepIdx !== steps.length - 1 && (
                <div
                  className="absolute top-4 left-0 -ml-px mt-0.5 h-0.5 w-full"
                  style={{ left: "2rem" }}
                  aria-hidden="true"
                >
                  <div className="h-full w-full bg-gray-300"></div>
                  <div
                    className="h-full bg-indigo-600 transition-all duration-500 ease-in-out"
                    style={{
                      width: step.id < currentStep ? "100%" : "0%",
                      position: "absolute",
                      top: 0,
                    }}
                  ></div>
                </div>
              )}

              <div className="group flex flex-col items-start">
                {/* Step circle */}
                <div className="flex items-center relative">
                  {step.id < currentStep ? (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 shadow-md transition-all duration-300 transform group-hover:scale-110">
                      <CheckIcon
                        className="h-6 w-6 text-white animate-fadeIn"
                        aria-hidden="true"
                      />
                      <span className="sr-only">{step.name}</span>
                    </span>
                  ) : step.id === currentStep ? (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-indigo-600 bg-white shadow-md transition-all duration-300 animate-pulse-custom">
                      <span className="text-indigo-600">{step.icon}</span>
                      <span className="sr-only">{step.name}</span>
                    </span>
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-300 bg-white group-hover:border-gray-400 transition-all duration-300">
                      <span className="text-gray-400 group-hover:text-gray-500 transition-colors duration-300">
                        {step.icon}
                      </span>
                      <span className="sr-only">{step.name}</span>
                    </span>
                  )}

                  {/* Step label */}
                  <div className="ml-4 mt-0">
                    <p
                      className={`text-sm font-medium ${
                        step.id <= currentStep
                          ? "text-indigo-600"
                          : "text-gray-500"
                      } transition-colors duration-300`}
                    >
                      Step {step.id}
                    </p>
                    <p
                      className={`text-base font-semibold ${
                        step.id <= currentStep
                          ? "text-gray-900"
                          : "text-gray-500"
                      } transition-colors duration-300`}
                    >
                      {step.name}
                    </p>
                    <p
                      className={`text-xs ${
                        step.id <= currentStep
                          ? "text-gray-600"
                          : "text-gray-400"
                      } mt-0.5 transition-colors duration-300 hidden sm:block`}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}

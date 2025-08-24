import React, { useState, type FormEvent } from 'react'
import FileUploader from '~/components/FileUploader';
import Navbar from '~/components/Navbar'
import { usePuterStore } from '~/lib/puter';
import { useNavigate } from 'react-router';
import { convertPdfToImage } from '~/lib/pdf2img';
import { generateUUID } from '~/lib/utils';
import { AIResponseFormat, prepareInstructions } from '../../constants';


const Upload = () => {

  const { auth, isLoading, fs, ai, kv } = usePuterStore();
  const navigate = useNavigate();

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const handleFileSelect = (file: File | null) => {
    setFile(file);
  }

  const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string; jobTitle: string; jobDescription: string; file: File }) => {
    setIsProcessing(true);

    setStatusText("Converting PDF to Image...");
    const uploadFile = await fs.upload([file]);
    if (!uploadFile) return setStatusText("File upload failed");

    setStatusText('uploading the image...');
    const pdfImage = await convertPdfToImage(file);
    if (!pdfImage?.file) return setStatusText("Image conversion failed");

    setStatusText('Uploading the image...');
    const uploadedImage = await fs.upload([pdfImage.file]);
    if (!uploadedImage) return setStatusText('Error: Failed to upload image');

    setStatusText('Preparing for data...');
    const uuid = generateUUID();
    const data = {
      id: uuid,
      resumePath: uploadFile.path,
      imagePath: uploadedImage.path,
      companyName,
      jobTitle,
      jobDescription,
      feedback: '',
    }

    await kv.set(`resume:${uuid}`, JSON.stringify(data));

    setStatusText('Analyzing...');

    const feedback = await ai.feedback(
      uploadFile.path,
      prepareInstructions({ jobTitle, jobDescription, AIResponseFormat })
    );

    if (!feedback) return setStatusText("Failed to analyze the resume");

    const feedbackText = typeof feedback.message.content === 'string' ? feedback.message.content :
      feedback.message.content[0].text;

    data.feedback = JSON.parse(feedbackText);
    await kv.set(`resume:${uuid}`, JSON.stringify(data));
    setStatusText('analysis complete, redirecting....')

    console.log(data);
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget.closest('form');

    if (!form) return;
    const formData = new FormData(form);

    const companyName = formData.get('company-name');
    const jobTitle = formData.get('job-title');
    const jobDescription = formData.get('job-description');

    if (!file) return;

    handleAnalyze({ companyName: companyName as string, jobTitle: jobTitle as string, jobDescription: jobDescription as string, file });
  }

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar />

      <section className="main-section">

        <div className="flex flex-col items-center gap-2  pb-5 mx-4 sm:mx-10 lg:mx-20">
          <h1 className="text-xl font-semibold text-center">
            Smart Feedback for your dream job
          </h1>
          {isProcessing ? (
            <>
              <h2 className="text-lg">{statusText}</h2>
              <img src="/images/resume-scan.gif" className="w-1/2 max-w-lg" />
            </>
          ) : (
            <h2 className="text-lg text-center">
              Drop your resume for an ATS score and improvement tips
            </h2>
          )}

          {!isProcessing && (
            <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
              </div>
              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
              </div>
              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
              </div>

              <div className="form-div">
                <label htmlFor="uploader">Upload Resume</label>
                <FileUploader onFileSelect={handleFileSelect} />
              </div>

              <button className="primary-button" type="submit">
                Analyze Resume
              </button>
            </form>
          )}
        </div>

      </section>

    </main>
  )
}

export default Upload


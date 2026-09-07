import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form';
import { apiConnector } from '../../services/apiconnector';
import { contactusEndpoint } from '../../services/apis';
import CountryCode from '../../data/countrycode.json'

const ContactUsForm = () => {
    const [loading, setLoading] = useState(false);
    const {
        register,
        handleSubmit,
        reset,
        formState: {errors, isSubmitSuccessful}
    } = useForm();

    const submitContactForm = async(data) => {
        console.log("Logging Data", data);
        try{
            setLoading(true);
            const response = await apiConnector("POST", contactusEndpoint.CONTACT_US_API, data)
            // const response = {status: "OK"}
            console.log("Logging response", response)
            setLoading(false);
        }
        catch(error){
            console.log("Error:", error.message)
            setLoading(false);
        }
    }

    useEffect(() => {
        if(isSubmitSuccessful){
            reset({
                email:'',
                firstname:'',
                lastname:'',
                message:'',
                phoneNo:'',
            })
        }
    }, [reset, isSubmitSuccessful])

    
    return (
        <form 
            onSubmit={handleSubmit(submitContactForm)}
            className="flex flex-col gap-5 "
        >
            {/* Name Fields Row */}
            <div className='flex flex-col sm:flex-row gap-4 sm:gap-5'>
                {/* First Name */}
                <div className='flex flex-col gap-2 flex-1'>
                    <label 
                        htmlFor='firstname'
                        className='text-sm text-richblack-5'
                    >
                        First Name
                    </label>
                    <input 
                        type="text" 
                        name='firstname'
                        id='firstname'
                        placeholder='Enter first name'
                        className='bg-richblack-800 rounded-[0.5rem] text-richblack-5 w-full p-[12px] text-[16px]'
                        style={{
                            boxShadow: "inset 0px -1px 5px rgba(255, 255, 255, 0.18)",
                        }}
                        {...register('firstname', {required:true})} 
                    />
                    {
                        errors.firstname && (
                            <span className='text-[12px] text-yellow-25 -mt-1'>
                                Please enter your name.
                            </span>
                        )
                    }
                </div>

                {/* Last Name */}
                <div className='flex flex-col gap-2 flex-1'>
                    <label 
                        htmlFor='lastname'
                        className='text-sm text-richblack-5'
                    >
                        Last Name
                    </label>
                    <input 
                        type="text" 
                        name='lastname'
                        id='lastname'
                        placeholder='Enter last name'
                        className='bg-richblack-800 rounded-[0.5rem] text-richblack-5 w-full p-[12px] text-[16px]'
                        style={{
                            boxShadow: "inset 0px -1px 5px rgba(255, 255, 255, 0.18)",
                        }}
                        {...register('lastname')} 
                    />
                </div>
            </div>

            {/* Email */}
            <div className='flex flex-col gap-2'>
                <label 
                    htmlFor="email"
                    className='text-sm text-richblack-5'
                >
                    Email Address
                </label>
                <input 
                    type="email" 
                    name='email'
                    id='email'
                    placeholder='Enter email address'
                    className='bg-richblack-800 rounded-[0.5rem] text-richblack-5 w-full p-[12px] text-[16px]'
                    style={{
                        boxShadow: "inset 0px -1px 5px rgba(255, 255, 255, 0.18)",
                    }}
                    {...register('email', {required: true})} 
                />
                {
                    errors.email && (
                        <span className='text-[12px] text-yellow-25 -mt-1'>
                            Please enter your email address.
                        </span>
                    )
                }
            </div>

            {/* Phone Number */}
            <div className='flex flex-col gap-2'>
                <label 
                    htmlFor="phonenumber"
                    className='text-sm text-richblack-5'
                >
                    Phone Number
                </label>
                <div className='flex gap-3 sm:gap-5'>
                    {/* Country Code Dropdown */}
                    <div className='flex w-[75px] sm:w-[85px] flex-col gap-2 flex-shrink-0'>
                        <select 
                            name="countrycode" 
                            id="countrycode"
                            className='bg-richblack-800 rounded-[0.5rem] text-richblack-5 w-full p-[12px] text-sm sm:text-[16px]'
                            style={{
                                boxShadow: "inset 0px -1px 5px rgba(255, 255, 255, 0.18)",
                            }}
                            {...register("countrycode", {required: true})}
                        >
                            {
                                CountryCode.map((element, index) => {
                                    return (
                                        <option 
                                            key={index}
                                            value={element.code}
                                        >
                                            {element.code} - {element.country}
                                        </option>
                                    )
                                })
                            }
                        </select>
                    </div>

                    {/* Phone Number Input */}
                    <div className='flex flex-col gap-2 flex-1'>
                        <input
                            type="tel"
                            name='phonenumber'
                            id='phonenumber'
                            placeholder='12345 67890'
                            className='bg-richblack-800 rounded-[0.5rem] text-richblack-5 w-full p-[12px] text-[16px]'
                            style={{
                                boxShadow: "inset 0px -1px 5px rgba(255, 255, 255, 0.18)",
                            }}
                            {...register("phoneNo", 
                                {
                                    required: {value: true, message: "Please enter Phone Number"},
                                    maxLength: {value:12, message: "Invalid Phone Number"},
                                    minLength: {value:10, message: "Invalid Phone Number"}
                                }
                            )}
                        />
                    </div>
                </div>
                {
                    errors.phoneNo && (
                        <span className='text-[12px] text-yellow-25 -mt-1'>
                            {errors.phoneNo.message}
                        </span>
                    )
                }
            </div>

            {/* Message */}
            <div className='flex flex-col gap-2'>
                <label 
                    htmlFor="message"
                    className='text-sm text-richblack-5'
                >
                    Message
                </label>
                <textarea 
                    name="message" 
                    id="message"
                    cols="30"
                    rows='7'
                    placeholder='Enter your message here'
                    className='bg-richblack-800 rounded-[0.5rem] text-richblack-5 w-full p-[12px] text-[16px]'
                    style={{
                        boxShadow: "inset 0px -1px 5px rgba(255, 255, 255, 0.18)",
                    }}
                    {...register("message",{required: true})}
                />
                {
                    errors.message && ( 
                        <span className='text-[12px] text-yellow-25 -mt-1'>
                            Please enter your message.
                        </span>
                    )
                }
            </div>

            {/* Submit Button */}
            <button 
                type='submit'
                disabled={loading}
                className='rounded-md bg-yellow-50 px-6 py-3 text-center text-[13px] font-bold text-black shadow-[2px_2px_0px_0px_rgba(255,255,255,0.18)] 
                 transition-all duration-200 hover:scale-95 hover:shadow-none disabled:bg-richblack-500 disabled:cursor-not-allowed
                 sm:text-[16px] '
            >
                Send Message
            </button>
        </form>
    )
}

export default ContactUsForm
